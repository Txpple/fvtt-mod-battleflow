// One-off probe for the Sneak Attack fixture (2026-09-02): can a hand-built character carry a
// class item at a level and resolve its scale values — `@scale.rogue.sneak-attack`, and a
// subclass's `@scale.gloom.dreadful-strike` — without the advancement manager? The clones the
// fixture suite uses are built from real party sheets; there is no rogue on this table, so the
// rogue fixture has to be BUILT, and NOTES §2 warns an unresolved @scale token rolls ZERO in
// silence. Creates a probe actor, reads the roll data, deletes it. Read-only otherwise.
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const env = loadEnv();
const f = await connectSuite({ tag: "probe-rogue", watchdogMs: 300_000, requireElect: false, env });

const out = await f.evaluate(async () => {
  const log = [];
  const findItem = async (packId, name) => {
    const pack = game.packs.get(packId);
    const index = await pack.getIndex();
    const hit = index.find(e => e.name === name);
    return hit ? (await pack.getDocument(hit._id)).toObject() : null;
  };
  let actor = null;
  try {
    const PACK = "dnd-players-handbook.classes";
    const rogue = await findItem(PACK, "Rogue");
    const thief = await findItem(PACK, "Thief");
    const ranger = await findItem(PACK, "Ranger");
    const gloom = await findItem(PACK, "Gloom Stalker");
    const feats = [];
    for ( const n of ["Sneak Attack", "Cunning Strike", "Devious Strikes", "Improved Cunning Strike", "Supreme Sneak", "Dread Ambusher"] ) {
      const it = await findItem(PACK, n);
      log.push(`${n}: ${it ? "found" : "MISSING"}`);
      if ( it ) feats.push(it);
    }
    const rapier = await findItem("dnd-players-handbook.equipment", "Rapier");
    log.push(`Rapier: ${rapier ? "found" : "MISSING"} props=${JSON.stringify(rapier?.system?.properties)}`);
    const items = [];
    if ( rogue ) { rogue.system.levels = 14; items.push(rogue); }
    if ( thief ) items.push(thief);
    if ( ranger ) { ranger.system.levels = 3; items.push(ranger); }
    if ( gloom ) items.push(gloom);
    items.push(...feats);
    if ( rapier ) items.push(rapier);
    for ( const i of items ) delete i._id;
    actor = await Actor.create({ name: "BF Probe Rogue", type: "character", items,
      system: { abilities: { dex: { value: 18 } } } });
    const rd = actor.getRollData();
    const scale = rd.scale ?? {};
    const sneak = foundry.utils.getProperty(rd, "scale.rogue.sneak-attack");
    const dread = foundry.utils.getProperty(rd, "scale.gloom.dreadful-strike");
    const replaced = Roll.replaceFormulaData("@scale.rogue.sneak-attack", rd);
    const replacedNumber = Roll.replaceFormulaData("@scale.rogue.sneak-attack.number", rd);
    const sneakItem = actor.items.find(i => i.name === "Sneak Attack");
    const act = sneakItem?.system?.activities?.contents?.[0] ?? [...(sneakItem?.system?.activities ?? [])][0];
    const part = act?.damage?.parts?.[0];
    const prof = actor.system.attributes?.prof;
    const dc = 8 + prof + (actor.system.abilities?.dex?.mod ?? 0);
    const cs = actor.items.find(i => i.name === "Cunning Strike");
    const csActs = [...(cs?.system?.activities ?? [])].map(a => ({ name: a.name, type: a.type, dc: a.save?.dc?.value ?? null, calc: a.save?.dc?.calculation }));
    return { ok: true, log, scaleKeys: Object.keys(scale), rogueScale: scale.rogue ? Object.keys(scale.rogue) : null,
      sneak: sneak ? { formula: sneak.formula ?? String(sneak), number: sneak.number, faces: sneak.faces, cls: sneak.constructor?.name } : null,
      dread: dread ? { formula: sneak?.formula ?? String(dread), cls: dread.constructor?.name } : null,
      replaced, replacedNumber, partFormula: part ? `${part.number}d${part.denomination} custom=${part.custom?.enabled}:${part.custom?.formula}` : null,
      partScaled: (() => { try { return act?.damage?.parts?.[0]?.formula ?? null; } catch (e) { return 'ERR ' + e.message; } })(),
      prof, dexMod: actor.system.abilities?.dex?.mod, dc, csActs,
      classes: Object.keys(actor.classes ?? {}), subclasses: actor.items.filter(i => i.type === "subclass").map(i => `${i.name}:${i.system.identifier}:${i.system.classIdentifier}`) };
  } catch(err) {
    return { ok: false, why: `${err.message}\n${err.stack}`, log };
  } finally {
    if ( actor ) await actor.delete().catch(() => {});
  }
}, null);

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, "probe-rogue");
process.exit(0);
