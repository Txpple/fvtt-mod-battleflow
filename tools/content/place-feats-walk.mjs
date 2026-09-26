// Build the PHB feats walk (groups 1–3, RULINGS *The PHB feats — groups 1–3*) on Party Camp — the
// user, 2026-09-26: "clear it and make it appropriate for testing 1-3 feats". CLEARS every token
// on Party Camp, then builds one walker per feat and the dummies each rule needs, and places them:
//   melee (north):  Slasher W, Piercer E, Crusher N of the Dummy; the Huge Dummy beside Crusher
//                   (its push must NOT be offered — two sizes larger); Poisoner beside the
//                   Resistant Dummy (fire, poison), Elemental Adept 15 ft from it
//   ranged (south): Sharpshooter, Spell Sniper, Crossbow Expert in a column on the west edge; the
//                   Point-Blank Dummy adjacent to Crossbow Expert only; the Half Cover Dummy 30 ft
//                   east; the Far Dummy 90 ft east (a Shortbow's long range, Ray of Frost + 60)
// The walkers are CLEAN copies of BF Test Fighter / BF Test Sorcerer — the class item and a few
// core features only: no subclass, no masteries, no other style or feat, so every line on a card is
// the feat under test. Linked tokens; idempotent (the walk's actors are rebuilt, not duplicated).
// A content tool, not a suite — it asserts nothing. ⚠ Disconnect the MCP bridge first.
import { connectSuite } from '../harness.mjs';

const f = await connectSuite({ tag: 'place-feats-walk', watchdogMs: 240_000 });
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
    'BF Feat Slasher': { base: 'fighter', feat: 'Slasher', dex: 12, items: [['Longsword', 'weapon', true]] },
    'BF Feat Crusher': { base: 'fighter', feat: 'Crusher', dex: 12, items: [['Mace', 'weapon', true], ['Warhammer', 'weapon', false], ['Dagger', 'weapon', false]] },
    'BF Feat Piercer': { base: 'fighter', feat: 'Piercer', dex: 16, items: [['Rapier', 'weapon', true], ['Shortsword', 'weapon', false]] },
    'BF Feat Poisoner': { base: 'fighter', feat: 'Poisoner', dex: 16,
      items: [['Poison Spray', 'spell', true], ['Dagger', 'weapon', true], ['Poison, Basic', 'consumable', false, 3], ['Poisoner\'s Kit', 'tool', false]] },
    'BF Feat Sharpshooter': { base: 'fighter', feat: 'Sharpshooter', dex: 16,
      items: [['Longbow', 'weapon', true], ['Shortbow', 'weapon', false], ['Dart', 'weapon', false, 10], ['Dagger', 'weapon', false], ['Arrows', 'consumable', false, 40]] },
    'BF Feat Crossbow Expert': { base: 'fighter', feat: 'Crossbow Expert', dex: 16,
      items: [['Hand Crossbow', 'weapon', true], ['Dagger', 'weapon', true], ['Light Crossbow', 'weapon', false], ['Dart', 'weapon', false, 10], ['Bolts', 'consumable', false, 40]] },
    'BF Feat Elemental Adept': { base: 'sorcerer', feat: 'Elemental Adept', rename: 'Elemental Adept (Fire)',
      items: [['Fire Bolt', 'spell', true], ['Burning Hands', 'spell', true], ['Scorching Ray', 'spell', true], ['Chromatic Orb', 'spell', true], ['Ray of Frost', 'spell', true]] },
    'BF Feat Spell Sniper': { base: 'sorcerer', feat: 'Spell Sniper',
      items: [['Fire Bolt', 'spell', true], ['Ray of Frost', 'spell', true], ['Chromatic Orb', 'spell', true]] }
  };
  const KEEP = { fighter: ['Second Wind', 'Action Surge', 'Extra Attack'], sorcerer: [] };
  const DUMMIES = {
    'BF Walk Dummy': {},
    'BF Walk Dummy (Resists Fire, Poison)': { dr: ['fire', 'poison'] },
    'BF Walk Dummy (Huge)': { size: 'huge', cells: 3 },
    'BF Walk Dummy (Half Cover)': { status: 'coverHalf' },
    'BF Walk Dummy (Point-Blank)': {},
    'BF Walk Dummy (Far)': {}
  };
  const stale = game.actors.filter(a => (a.name in WALKERS) || (a.name in DUMMIES)).map(a => a.id);
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
    o.folder = folder.id;
    return o;
  };

  const made = {};
  for (const [name, w] of Object.entries(WALKERS)) {
    const src = w.base === 'fighter' ? fighter : sorcerer;
    const o = clean(src, KEEP[w.base]);
    o.name = name;
    o.prototypeToken = { ...o.prototypeToken, name, actorLink: true, disposition: 1 };
    if (w.dex) o.system.abilities.dex.value = w.dex;
    const feat = await phb(w.feat, 'feat');
    if (feat) { if (w.rename) feat.name = w.rename; o.items.push(feat); }
    if (w.base === 'fighter') {
      const mail = await phb('Chain Mail', 'equipment');
      if (mail) { mail.system.equipped = true; o.items.push(mail); }
    }
    for (const [iname, type, on, qty] of w.items) {
      const it = await phb(iname, type);
      if (!it) continue;
      if (type === 'spell') it.system.prepared = 1;
      else if ('equipped' in (it.system ?? {}) || (type === 'weapon')) it.system.equipped = !!on;
      if (qty) it.system.quantity = qty;
      o.items.push(it);
    }
    if (w.base === 'sorcerer') {
      for (const [k, v] of [['spell1', 4], ['spell2', 3], ['spell3', 2]]) foundry.utils.setProperty(o, `system.spells.${k}.value`, v);
    }
    o.system.attributes.hp.value = o.system.attributes.hp.max ?? o.system.attributes.hp.value;
    made[name] = await Actor.create(o);
  }
  for (const [name, d] of Object.entries(DUMMIES)) {
    const img = dummyArt?.img ?? 'icons/svg/mystery-man.svg';
    const tex = dummyArt?.prototypeToken?.texture?.src ?? img;
    const cells = d.cells ?? 1;
    const a = await Actor.create({
      name, type: 'npc', img, folder: folder.id,
      system: {
        attributes: { hp: { value: 999, max: 999 }, ac: { calc: 'flat', flat: 12 }, movement: { walk: 0 } },
        traits: { size: d.size ?? 'med', dr: { value: d.dr ?? [] } },
        details: { type: { value: 'construct' }, cr: 0 }
      },
      prototypeToken: { name, actorLink: true, disposition: -1, width: cells, height: cells, texture: { src: tex, scaleX: 1.2, scaleY: 1.2 } }
    });
    if (d.status) await a.toggleStatusEffect(d.status, { active: true });
    made[name] = a;
  }

  // --- 3. placed
  const SPOTS = {
    'BF Walk Dummy': [1820, 1400],
    'BF Feat Slasher': [1680, 1400],
    'BF Feat Piercer': [1960, 1400],
    'BF Feat Crusher': [1820, 1260],
    'BF Walk Dummy (Huge)': [1400, 980],
    'BF Walk Dummy (Resists Fire, Poison)': [1820, 1820],
    'BF Feat Poisoner': [1680, 1820],
    'BF Feat Elemental Adept': [2240, 1820],
    'BF Feat Sharpshooter': [980, 2380],
    'BF Feat Spell Sniper': [980, 2660],
    'BF Feat Crossbow Expert': [980, 2940],
    'BF Walk Dummy (Point-Blank)': [1120, 2940],
    'BF Walk Dummy (Half Cover)': [1820, 2520],
    'BF Walk Dummy (Far)': [3500, 2520]
  };
  const tokens = [];
  for (const [name, [x, y]] of Object.entries(SPOTS)) {
    const a = made[name];
    if (!a) { log.push(`${name}: NOT BUILT`); continue; }
    tokens.push(foundry.utils.mergeObject(a.prototypeToken.toObject(), { x, y, actorId: a.id, actorLink: true, displayName: CONST.TOKEN_DISPLAY_MODES.ALWAYS, displayBars: CONST.TOKEN_DISPLAY_MODES.ALWAYS }, { inplace: false }));
  }
  await scene.createEmbeddedDocuments('Token', tokens);
  log.push(`placed ${tokens.length} token(s)`);

  // the readback: what each walker holds, and what each dummy is
  const read = Object.fromEntries(Object.entries(made).map(([n, a]) => [n, a.type === 'npc'
    ? `AC ${a.system.attributes.ac.value} (cover ${a.system.attributes.ac.cover ?? 0}), ${a.system.traits.size}, dr [${[...a.system.traits.dr.value].join(',')}]`
    : `L${a.system.details.level} · ${a.items.filter(i => i.type !== 'class').map(i => i.name + (i.system.equipped ? '*' : '')).join(', ')}`]));
  return { log, missing, read };
}, null);
console.log(JSON.stringify(out, null, 2));
await f.disconnect?.();
process.exit(out?.error ? 1 : 0);
