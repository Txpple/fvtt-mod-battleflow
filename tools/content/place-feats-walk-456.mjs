// Build the PHB feats walk scene for groups 4–6 (RULINGS *The PHB feats — groups 4–6*) on Party Camp.
// CLEARS every token on Party Camp, then builds one walker per feat plus the creature each rule needs:
//   north: BF Walk Caster (hostile; Bless, Command, a Scimitar) with BF Feat Mage Slayer 5 ft west and
//          BF Feat Sentinel 5 ft east; BF Feat Polearm Master (Glaive held) three squares north of it.
//   south: BF Feat Inspiring Leader and BF Feat Chef, 5 ft apart, out of the north's 30 ft.
// Walkers start at HALF HP (a Short Rest has Hit Dice worth spending) and are CLEAN copies of BF Test
// Fighter / Sorcerer, so every card line is the feat's. Linked tokens; idempotent; asserts nothing.
// ⚠ Disconnect the MCP bridge first.
import { connectSuite } from '../harness.mjs';

const f = await connectSuite({ tag: 'place-feats-walk-456', watchdogMs: 240_000 });
const out = await f.evaluate(async () => {
  const log = [];
  const scene = game.scenes.getName('Party Camp');
  if (!scene) return { error: 'no Party Camp' };
  const fighter = game.actors.getName('BF Test Fighter');
  const sorcerer = game.actors.getName('BF Test Sorcerer');
  const dummyArt = game.actors.getName('Practice Dummy');
  if (!fighter || !sorcerer) return { error: 'BF Test Fighter or BF Test Sorcerer is missing — run fixture-suite first' };
  const folder = game.folders.find(x => (x.name === 'Test Suite') && (x.type === 'Actor'))
    ?? await Folder.create({ name: 'Test Suite', type: 'Actor', color: '#4b5563' });

  // --- the PHB's own items, by name and type
  const index = [];
  for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
    for (const e of await pack.getIndex({ fields: ['type'] })) index.push({ pack, e });
  }
  const missing = [];
  const phb = async (name, type) => {
    const hit = index.find(({ e }) => (e.name === name) && (e.type === type));
    if (!hit) { missing.push(`${type} ${name}`); return null; }
    const obj = (await hit.pack.getDocument(hit.e._id)).toObject();
    delete obj._id;
    return obj;
  };

  // --- 1. clear Party Camp
  const ids = scene.tokens.map(t => t.id);
  if (ids.length) await scene.deleteEmbeddedDocuments('Token', ids);
  log.push(`cleared ${ids.length} token(s) from Party Camp`);

  // --- 2. the walk's actors, rebuilt fresh
  const WALKERS = {
    'BF Feat Mage Slayer': { base: 'fighter', feat: 'Mage Slayer', items: [['Longsword', 'weapon', true]] },
    'BF Feat Sentinel': { base: 'fighter', feat: 'Sentinel', items: [['Longsword', 'weapon', true]] },
    'BF Feat Polearm Master': { base: 'fighter', feat: 'Polearm Master', items: [['Glaive', 'weapon', true], ['Quarterstaff', 'weapon', false]] },
    'BF Feat Inspiring Leader': { base: 'sorcerer', feat: 'Inspiring Leader', items: [['Fire Bolt', 'spell', true]] },
    'BF Feat Chef': { base: 'fighter', feat: 'Chef', items: [['Longsword', 'weapon', true], ["Cook's Utensils", 'tool', false]] }
  };
  const KEEP = { fighter: ['Second Wind', 'Action Surge', 'Extra Attack'], sorcerer: [] };
  const CASTER = 'BF Walk Caster';
  const stale = game.actors.filter(a => (a.name in WALKERS) || (a.name === CASTER)).map(a => a.id);
  if (stale.length) await Actor.deleteDocuments(stale);
  if (stale.length) log.push(`rebuilt: ${stale.length} earlier walk actor(s) deleted`);

  const clean = (src, keep) => {
    const o = src.toObject();
    delete o._id;
    o.items = o.items.filter(i => (i.type === 'class') || keep.includes(i.name));
    o.effects = [];
    if (o.flags) delete o.flags['fvtt-mod-battleflow'];
    if (o.flags) delete o.flags.battleflow;
    foundry.utils.setProperty(o, 'system.traits.weaponProf.mastery.value', []);
    foundry.utils.setProperty(o, 'system.traits.dr.value', []);
    foundry.utils.setProperty(o, 'system.attributes.inspiration', false);   // no Heroic Inspiration row beside the feat's
    o.folder = folder.id;
    return o;
  };

  const made = {};
  for (const [name, w] of Object.entries(WALKERS)) {
    const src = w.base === 'fighter' ? fighter : sorcerer;
    const o = clean(src, KEEP[w.base]);
    o.name = name;
    o.prototypeToken = { ...o.prototypeToken, name, actorLink: true, disposition: 1 };
    const feat = await phb(w.feat, 'feat');
    if (feat) o.items.push(feat);
    if (w.base === 'fighter') {
      const mail = await phb('Chain Mail', 'equipment');
      if (mail) { mail.system.equipped = true; o.items.push(mail); }
    }
    for (const [iname, type, on] of w.items) {
      const it = await phb(iname, type);
      if (!it) continue;
      if (type === 'spell') it.system.prepared = 1;
      else if ('equipped' in (it.system ?? {}) || (type === 'weapon')) it.system.equipped = !!on;
      o.items.push(it);
    }
    const a = await Actor.create(o);
    const max = Number(a.system.attributes.hp.max) || 20;
    await a.update({ 'system.attributes.hp.value': Math.max(1, Math.floor(max / 2)), 'system.attributes.hp.temp': 0 });
    made[name] = a;
  }

  // The Caster: concentrates (Bless), demands a Wisdom save (Command), swings (a Scimitar); spells at will.
  {
    const img = dummyArt?.img ?? 'icons/svg/mystery-man.svg';
    const tex = dummyArt?.prototypeToken?.texture?.src ?? img;
    const items = [];
    for (const [iname, type] of [['Bless', 'spell'], ['Command', 'spell'], ['Scimitar', 'weapon']]) {
      const it = await phb(iname, type);
      if (!it) continue;
      if (type === 'spell') { it.system.method = 'atwill'; it.system.prepared = 1; }
      if (type === 'weapon') { it.system.equipped = true; it.system.proficient = 1; }
      items.push(it);
    }
    made[CASTER] = await Actor.create({
      name: CASTER, type: 'npc', img, folder: folder.id, items,
      system: {
        abilities: { str: { value: 12 }, dex: { value: 14 }, con: { value: 12 }, wis: { value: 16 } },
        attributes: { hp: { value: 300, max: 300 }, ac: { calc: 'flat', flat: 12 }, movement: { walk: 30 }, spellcasting: 'wis' },
        details: { type: { value: 'humanoid' }, cr: 2, spellLevel: 3 }
      },
      prototypeToken: { name: CASTER, actorLink: true, disposition: -1, width: 1, height: 1, texture: { src: tex, scaleX: 1.2, scaleY: 1.2 } }
    });
  }

  // --- 3. placed (Party Camp's grid is 140 px: one square, 5 ft)
  const SPOTS = {
    [CASTER]: [1820, 1400],
    'BF Feat Mage Slayer': [1680, 1400],
    'BF Feat Sentinel': [1960, 1400],
    'BF Feat Polearm Master': [1820, 980],   // three squares north of the Caster: move the Caster one square toward it — its Glaive reaches 10 ft
    'BF Feat Inspiring Leader': [1820, 2380],
    'BF Feat Chef': [1960, 2380]
  };
  const tokens = [];
  for (const [name, [x, y]] of Object.entries(SPOTS)) {
    const a = made[name];
    if (!a) { log.push(`${name}: NOT BUILT`); continue; }
    tokens.push(foundry.utils.mergeObject(a.prototypeToken.toObject(), { x, y, actorId: a.id, actorLink: true,
      displayName: CONST.TOKEN_DISPLAY_MODES.ALWAYS, displayBars: CONST.TOKEN_DISPLAY_MODES.ALWAYS }, { inplace: false }));
  }
  await scene.createEmbeddedDocuments('Token', tokens);
  log.push(`placed ${tokens.length} token(s)`);

  // the readback: what each walker holds and its hit points
  const read = Object.fromEntries(Object.entries(made).map(([n, a]) => [n,
    `L${a.system.details.level ?? a.system.details.cr} · HP ${a.system.attributes.hp.value}/${a.system.attributes.hp.max} · `
    + a.items.filter(i => i.type !== 'class').map(i => i.name + (i.system.equipped ? '*' : '')).join(', ')]));
  return { log, missing, read };
}, null);
console.log(JSON.stringify(out, null, 2));
await f.disconnect?.();
process.exit(out?.error ? 1 : 0);
