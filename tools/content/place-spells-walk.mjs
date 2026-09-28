// Build the spells slice's walk scene (RULINGS *The spells slice — Tiers 1 and 2*) on Party Camp.
// CLEARS every token on Party Camp, then places BF Walk Cleric (friendly; every spell of the slice at
// will, Cure Wounds beside them) with two targets 5 ft east of it: BF Walk Target (hostile — the
// one Hold Person, Command and the rest land on) and BF Walk Ally (friendly — Heroism, Beacon of Hope
// and Protection from Poison go on it). The targets are CLEAN copies of BF Test Victim's shape with
// plenty of Hit Points, linked tokens; idempotent; asserts nothing.
// ⚠ Disconnect the MCP bridge first.
import { connectSuite } from '../harness.mjs';

const f = await connectSuite({ tag: 'place-spells-walk', watchdogMs: 240_000 });
const out = await f.evaluate(async () => {
  const log = [];
  const scene = game.scenes.getName('Party Camp');
  if (!scene) return { error: 'no Party Camp' };
  const cleric = game.actors.getName('BF Test Cleric');
  const dummyArt = game.actors.getName('Practice Dummy');
  if (!cleric) return { error: 'BF Test Cleric is missing — run fixture-suite first' };
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
  const CASTER = 'BF Walk Cleric';
  const TARGET = 'BF Walk Target';
  const ALLY = 'BF Walk Ally';
  const stale = game.actors.filter(a => [CASTER, TARGET, ALLY].includes(a.name)).map(a => a.id);
  if (stale.length) await Actor.deleteDocuments(stale);
  if (stale.length) log.push(`rebuilt: ${stale.length} earlier walk actor(s) deleted`);

  const SPELLS = ['Protection from Poison', 'Haste', 'Beacon of Hope', "Otto's Irresistible Dance", 'Command', 'Sorcerous Burst',
    'Heroism', 'Synaptic Static', 'Hold Person', 'Hold Monster', "Tasha's Hideous Laughter", 'Blindness/Deafness', 'Crown of Madness',
    'Slow', 'Fear', 'Confusion', 'Phantasmal Killer', 'Eyebite', 'Contagion', 'Dominate Person', 'Flesh to Stone', 'Cure Wounds'];
  const made = {};
  {
    const o = cleric.toObject();
    delete o._id;
    o.name = CASTER;
    o.folder = folder.id;
    o.items = o.items.filter(i => (i.type === 'class') || (i.type === 'subclass') || (i.type === 'equipment') || (i.type === 'weapon'));
    o.effects = [];
    if (o.flags) { delete o.flags['fvtt-mod-battleflow']; delete o.flags.battleflow; }
    for (const name of SPELLS) {
      const it = await phb(name, 'spell');
      if (!it) continue;
      it.system.method = 'atwill';   // every spell of the slice at will — the walk never runs out of slots
      it.system.prepared = 1;
      o.items.push(it);
    }
    o.prototypeToken = { ...o.prototypeToken, name: CASTER, actorLink: true, disposition: 1 };
    made[CASTER] = await Actor.create(o);
    await made[CASTER].update({ 'system.attributes.hp.value': made[CASTER].system.attributes.hp.max });
  }
  const img = dummyArt?.img ?? 'icons/svg/mystery-man.svg';
  const tex = dummyArt?.prototypeToken?.texture?.src ?? img;
  for (const [name, disposition] of [[TARGET, -1], [ALLY, 1]]) {
    made[name] = await Actor.create({
      name, type: 'npc', img, folder: folder.id, items: [],
      system: {
        abilities: { str: { value: 12 }, dex: { value: 12 }, con: { value: 12 }, int: { value: 10 }, wis: { value: 10 }, cha: { value: 10 } },
        attributes: { hp: { value: 120, max: 120 }, ac: { calc: 'flat', flat: 12 }, movement: { walk: 30 } },
        details: { type: { value: 'humanoid' }, cr: 1 }
      },
      prototypeToken: { name, actorLink: true, disposition, width: 1, height: 1, texture: { src: tex } }
    });
  }

  // --- 3. placed (Party Camp's grid is 140 px: one square, 5 ft)
  const SPOTS = { [CASTER]: [1680, 1400], [TARGET]: [1820, 1400], [ALLY]: [1820, 1540] };
  const tokens = [];
  for (const [name, [x, y]] of Object.entries(SPOTS)) {
    const a = made[name];
    if (!a) { log.push(`${name}: NOT BUILT`); continue; }
    tokens.push(foundry.utils.mergeObject(a.prototypeToken.toObject(), { x, y, actorId: a.id, actorLink: true,
      displayName: CONST.TOKEN_DISPLAY_MODES.ALWAYS, displayBars: CONST.TOKEN_DISPLAY_MODES.ALWAYS }, { inplace: false }));
  }
  await scene.createEmbeddedDocuments('Token', tokens);
  log.push(`placed ${tokens.length} token(s)`);

  const read = Object.fromEntries(Object.entries(made).map(([n, a]) => [n,
    `HP ${a.system.attributes.hp.value}/${a.system.attributes.hp.max} · ` + a.items.filter(i => i.type === 'spell').map(i => i.name).join(', ')]));
  return { log, missing, read };
}, null);
console.log(JSON.stringify(out, null, 2));
await f.disconnect?.();
process.exit(out?.error ? 1 : 0);
