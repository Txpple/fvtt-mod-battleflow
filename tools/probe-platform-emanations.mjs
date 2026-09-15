// Probe: what dnd5e 6.0.1's own region behaviours do for aura spells, with Battle Flow OUT of the
// way. Two phases:
//   read     — module may stay on. For each aura spell on the BF Test Cleric (given from the
//              packs if missing), print activity.behaviors / applicableBehaviors / effects.
//   walk     — switches Battle Flow OFF in the world (and back ON at the end), starts the spell
//              (concentration), creates the region the way TemplatePlacement.fromActivity does
//              (placement itself needs a click — mimicked), lets the platform attach behaviours,
//              walks a FRIENDLY, a NEUTRAL and a HOSTILE token in and out, ends concentration,
//              and reports what landed and what cleaned up.
// Usage: node probe-platform-emanations.mjs read|walk
import { Foundry } from "file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js";
import { loadEnv } from "file:///D:/Workbench/FVTT/Repos/fvtt-mod-battleflow/tools/harness.mjs";
import { foundryConfig } from "file:///D:/Workbench/FVTT/Repos/fvtt-mod-battleflow/tools/target.mjs";

const phase = process.argv[2] ?? "read";
const SPELLS = ["Crusader's Mantle", "Aura of Life", "Aura of Vitality", "Antilife Shell", "Spirit Guardians"];
const sleepN = ms => new Promise(r => setTimeout(r, ms));

async function connect() {
  const f = new Foundry(foundryConfig(loadEnv()));
  await f.connect();
  return f;
}

const READ = async (SPELLS) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const cleric = game.actors.getName("BF Test Cleric");
  if (!cleric) return { fatal: "no BF Test Cleric" };
  const out = { system: game.system.version, module: game.modules.get("fvtt-mod-battleflow")?.active, spells: {} };
  for (const name of SPELLS) {
    let item = cleric.items.find(i => i.type === "spell" && i.name === name);
    if (!item) {
      for (const id of ["dnd-players-handbook.spells", "dnd5e.spells24"]) {
        const pack = game.packs.get(id); if (!pack) continue;
        const index = await pack.getIndex(); const hit = index.find(e => e.name === name); if (!hit) continue;
        const data = (await pack.getDocument(hit._id)).toObject(); delete data._id;
        data.system.preparation = { mode: "always", prepared: true };
        [item] = await cleric.createEmbeddedDocuments("Item", [data]);
        out.spells[name] = { givenFrom: id };
        break;
      }
    }
    if (!item) { out.spells[name] = { missing: true }; continue; }
    const acts = [...item.system.activities].map(a => ({
      name: a.name, type: a.type,
      template: a.target?.template ? { type: a.target.template.type, size: a.target.template.size, units: a.target.template.units } : null,
      affects: a.target?.affects ? { type: a.target.affects.type, count: a.target.affects.count, choice: a.target.affects.choice } : null,
      duration: a.duration ? { value: a.duration.value, units: a.duration.units, expiry: a.duration.expiry, concentration: a.duration.concentration } : null,
      behaviors: (a.behaviors ?? []).map(b => ({ type: b.type, name: b.name, level: b.level, config: b.config?.toObject?.() ?? b.config })),
      applicableBehaviors: (a.applicableBehaviors ?? []).map(b => b.type),
      effects: (a.effects ?? []).map(e => ({ id: e._id, uuid: e.uuid ?? null, onSave: e.onSave, level: e.level }))
    }));
    out.spells[name] = { ...(out.spells[name] ?? {}), itemEffects: item.effects.map(e => ({ id: e.id, name: e.name, type: e.type, transfer: e.transfer, changes: e.changes.map(c => `${c.key} ${c.type ?? c.mode} ${c.value}`), duration: e.duration.toObject?.() ?? null })), activities: acts };
  }
  out.behaviorTypes = Object.keys(CONFIG.DND5E.activityBehaviorTypes ?? {});
  out.regionBehaviorTypes = Object.keys(CONFIG.RegionBehavior.dataModels).filter(k => k.startsWith("dnd5e") || k.startsWith("fvtt-mod-battleflow"));
  return out;
};

const WALK = async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const waitFor = async (fn, ms = 6000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) return null; await sleep(step); } };
  const mv = () => ({ teleport: true, animate: false });
  const log = [];
  const scene = game.scenes.getName("Battle Flow Test Range");
  const cleric = game.actors.getName("BF Test Cleric"), ranger = game.actors.getName("BF Test Ranger"), victim = game.actors.getName("BF Test Victim"), paladin = game.actors.getName("BF Test Paladin");
  if (!scene || !cleric || !ranger || !victim || !paladin) return { fatal: "fixtures missing" };
  const tok = a => scene.tokens.find(t => t.actorId === a.id);
  const clrTok = tok(cleric), rgrTok = tok(ranger), vicTok = tok(victim), palTok = tok(paladin);
  if (game.scenes.active?.id !== scene.id) { await scene.activate(); await sleep(1500); }
  if (canvas.scene?.id !== scene.id) { await scene.view(); await sleep(1500); }
  const home = Object.fromEntries([clrTok, rgrTok, vicTok, palTok].map(t => [t.id, { x: t.x, y: t.y, disposition: t.disposition }]));
  const bfOff = !game.modules.get("fvtt-mod-battleflow")?.active;
  log.push(`battleflow active=${!bfOff} isActiveGM=${game.user.isActiveGM}`);

  const item = cleric.items.find(i => i.type === "spell" && i.name === "Crusader's Mantle");
  if (!item) return { fatal: "Crusader's Mantle not on the Cleric — run the read phase first" };
  const act = [...item.system.activities].find(a => a.target?.template?.type) ?? item.system.activities.contents[0];
  const fxNames = a => a.effects.map(e => `${e.name}${e.origin ? ` <${e.origin}>` : ""}${e.system?.origin ? ` sys=${JSON.stringify(e.system.origin)}` : ""}`);

  // clean slate
  for (const a of [cleric, ranger, victim, paladin]) { const ids = a.effects.filter(e => /Crusader/.test(e.name)).map(e => e.id); if (ids.length) await a.deleteEmbeddedDocuments("ActiveEffect", ids); }
  try { if (cleric.concentration?.effects?.size) await cleric.endConcentration(); } catch {}
  const stale = scene.regions.filter(r => r.getFlag("dnd5e", "item") === item.uuid).map(r => r.id);
  if (stale.length) await scene.deleteEmbeddedDocuments("Region", stale);
  await clrTok.update({ x: 1300, y: 600 }, mv());
  // everyone OUT first (far corner)
  await rgrTok.update({ x: 100, y: 100 }, mv()); await vicTok.update({ x: 100, y: 300 }, mv()); await palTok.update({ x: 100, y: 500, disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL }, mv());
  await sleep(500);

  // 1. use the spell WITHOUT placing (concentration starts); no template
  const m0 = game.messages.size;
  try {
    await Promise.race([act.use({ consume: { spellSlot: false, resources: false }, subsequentActions: false, create: { measuredTemplate: false } }, { configure: false }, { create: true }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("use() did not settle")), 8000))]);
  } catch (err) { log.push(`use(): ${err.message}`); }
  await sleep(800);
  const concentrating = cleric.concentration?.effects?.size ?? 0;
  log.push(`after use: concentration effects=${concentrating} messages+${game.messages.size - m0} regionsForItem=${scene.regions.filter(r => r.getFlag("dnd5e", "item") === item.uuid).length}`);

  // 2. create the region the way TemplatePlacement.fromActivity does (placement mimicked — a click headless)
  const gridMult = scene.grid.size / scene.grid.distance;
  const size = act.target.template.size * gridMult;
  const g = scene.grid.size; const base = { type: "rectangle", x: clrTok.x, y: clrTok.y, width: clrTok.width * g, height: clrTok.height * g, rotation: 0 };
  const rollData = act.getRollData();
  const regionData = [{
    name: `${item.name} [${game.user.name}]`, color: game.user.color,
    shapes: [{ type: "emanation", x: 0, y: 0, rotation: 0, radius: size, base }],
    levels: canvas.level ? [canvas.level.id] : undefined,
    restriction: { enabled: true, type: "move" },
    attachment: { token: clrTok.id },
    visibility: CONST.REGION_VISIBILITY.ALWAYS, highlightMode: "coverage",
    flags: { dnd5e: { activity: act.uuid, dimensions: { size: act.target.template.size, width: act.target.template.width, height: act.target.template.height, units: scene.grid.units }, item: item.uuid, origin: clrTok.uuid, spellLevel: rollData.item.level } }
  }];
  if (regionData[0].levels === undefined) delete regionData[0].levels;
  let region;
  try { [region] = await scene.createEmbeddedDocuments("Region", regionData); } catch (e) { return { fatal: `region create: ${e.message}`, log }; }
  if (!region) return { fatal: "region create returned nothing", log };
  let behaviors = await waitFor(() => region.behaviors.size ? [...region.behaviors] : null, 6000) ?? [];
  log.push(`region ${region.id} attached=${region.attachment?.token?.id === clrTok.id} AUTO behaviors=${JSON.stringify(behaviors.map(b => ({ type: b.type, name: b.name, system: b.system.toObject?.() ?? b.system })))}`);
  if (!behaviors.length) {
    // the pack declares none — author the platform's own behaviour by hand, the way
    // createBehaviorData would for an ally-affecting activity (dispositions → FRIENDLY only)
    const fx = item.effects.contents[0];
    try {
      await region.createEmbeddedDocuments("RegionBehavior", [{ type: "dnd5e.applyActiveEffect", name: "probe: apply " + fx.name,
        system: { effects: [fx.uuid], dispositions: [CONST.TOKEN_DISPOSITIONS.FRIENDLY], sizes: [], types: [] } }]);
      behaviors = [...region.behaviors];
      log.push(`HAND-AUTHORED behaviour: ${JSON.stringify(behaviors.map(b => ({ type: b.type, system: b.system.toObject?.() ?? b.system })))}`);
    } catch (e) { log.push(`behaviour create failed: ${e.message}`); }
  }

  // 3. walk them in: FRIENDLY ranger, NEUTRAL paladin, HOSTILE victim — 10 ft from the cleric each
  await rgrTok.update({ x: 1300, y: 300 }, mv()); await sleep(600);
  await palTok.update({ x: 1600, y: 600 }, mv()); await sleep(600);
  await vicTok.update({ x: 1300, y: 850 }, mv()); await sleep(600);
  await sleep(1500);
  const inside = { cleric: fxNames(cleric), ranger: fxNames(ranger), neutralPaladin: fxNames(paladin), hostileVictim: fxNames(victim), regionTokens: [...region.tokens].map(t => t.name) };
  log.push(`INSIDE: ${JSON.stringify(inside)}`);

  // 4. walk the ranger out
  await rgrTok.update({ x: 100, y: 100 }, mv()); await sleep(1500);
  log.push(`ranger OUT: ${JSON.stringify(fxNames(ranger))}`);
  // 5. back in, then end concentration
  await rgrTok.update({ x: 1300, y: 300 }, mv()); await sleep(1500);
  log.push(`ranger back IN: ${JSON.stringify(fxNames(ranger))}`);
  try { await cleric.endConcentration(); } catch (e) { log.push(`endConcentration: ${e.message}`); }
  await sleep(2000);
  log.push(`after endConcentration: region alive=${!!scene.regions.get(region.id)} ranger=${JSON.stringify(fxNames(ranger))} cleric=${JSON.stringify(fxNames(cleric))}`);
  // 6. delete the region if still standing, see if effects lift
  if (scene.regions.get(region.id)) { await region.delete(); await sleep(1500); log.push(`after region delete: ranger=${JSON.stringify(fxNames(ranger))}`); }

  // restore
  for (const a of [cleric, ranger, victim, paladin]) { const ids = a.effects.filter(e => /Crusader/.test(e.name)).map(e => e.id); if (ids.length) await a.deleteEmbeddedDocuments("ActiveEffect", ids); }
  for (const t of [clrTok, rgrTok, vicTok, palTok]) await t.update(home[t.id], mv());
  return { log };
};

const f = await connect();
if (phase === "read") {
  console.log(JSON.stringify(await f.evaluate(READ, SPELLS), null, 2));
} else if (phase === "walk") {
  console.log(JSON.stringify(await f.evaluate(WALK, null), null, 2));
} else if (phase === "module-off" || phase === "module-on") {
  const on = phase === "module-on";
  const r = await f.evaluate(async (on) => {
    const cfg = { ...game.settings.get("core", "moduleConfiguration"), "fvtt-mod-battleflow": on };
    await game.settings.set("core", "moduleConfiguration", cfg);
    return "set";
  }, on);
  console.log(r);
}
await f.dispose?.();
process.exit(0);
