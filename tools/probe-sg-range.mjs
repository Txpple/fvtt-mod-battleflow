// Probe (2026-09-10): SPIRIT GUARDIANS' REACH — the 2026-09-09 table report (BACKLOG *From
// play*): "Spirit Guardians rolled a save for Gren out of range". Three guesses were written
// down: the Region's radius, walls (a Region knows nothing of cover), a stale spent-area. This
// measures the first two on the range with the BF Test Cleric's own Spirit Guardians and the
// hostile BF Test Victim as the walker, and prints — asserts nothing:
//
//   • the template's distance and the Region's shape as the platform placed them;
//   • for a grid of offsets from the caster (squares, then feet by the scene's own ruler), whether
//     the Victim is a MEMBER (`region.tokens`), whether its centre is inside the Region's polygon
//     (`region.testPoint`), and whether the module DEMANDED a save on the entry (the trigger card);
//   • the same at one spot two squares away with a wall between (the cover guess).
//
// Everything it creates — the cast's template/region/concentration, the wall, the run's chat —
// is undone in `finally`; tokens go home; the settings it pins are handed back.
//
//   node tools/probe-sg-range.mjs
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const TAG = "probe-sg-range";
const f = await connectSuite({ tag: TAG, watchdogMs: 300_000, env: loadEnv() });

const out = await f.evaluate(async () => {
  const MOD = "fvtt-mod-battleflow";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const waitFor = async (fn, ms = 8000) => { const end = Date.now() + ms; while ( Date.now() < end ) { const v = await fn(); if ( v ) return v; await sleep(200); } return null; };
  const report = { foundry: game.version, system: `${game.system.id} ${game.system.version}`, module: game.modules.get(MOD)?.version, log: [] };
  const log = m => report.log.push(m);
  const started = Date.now();
  const mv = () => ({ teleport: true, animate: false });

  const SETTING_KEYS = ["emanations", "emanationList", "saves", "saveTimer", "playerRollDamage", "autoApply", "requireTarget"];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName("Battle Flow Test Range");
  const cleric = game.actors.getName("BF Test Cleric");
  const victim = game.actors.getName("BF Test Victim");
  if ( !scene || !cleric || !victim ) return { fatal: "missing fixture: the range, BF Test Cleric or BF Test Victim — run tools/fixture-suite.mjs" };
  const clrTok = scene.tokens.find(t => t.actorId === cleric.id), vicTok = scene.tokens.find(t => t.actorId === victim.id);
  if ( !clrTok || !vicTok ) return { fatal: "a fixture token is missing from the range — run tools/fixture-suite.mjs" };
  const priorActiveScene = game.scenes.active?.id ?? null;
  const home = { [clrTok.id]: { x: clrTok.x, y: clrTok.y }, [vicTok.id]: { x: vicTok.x, y: vicTok.y } };
  const grid = scene.grid.size, ft = scene.grid.distance;
  report.grid = { size: grid, distance: ft, units: scene.grid.units, type: scene.grid.type, diagonals: scene.grid.diagonals ?? null };

  let template = null, wall = null, region = null;
  const triggerCards = () => game.messages.filter(m => (m.timestamp >= started) && m.getFlag(MOD, "emanationTrigger"));
  const memberFx = actor => (actor?.effects ?? []).filter(e => e.getFlag(MOD, "emanation"));

  try {
    await set("emanations", true);
    if ( !/spirit guardians/i.test(prior.emanationList || "") ) await set("emanationList", `${prior.emanationList ? prior.emanationList + ", " : ""}Spirit Guardians`);
    await set("saves", true); await set("saveTimer", 0); await set("playerRollDamage", false); await set("autoApply", false); await set("requireTarget", false);
    if ( game.scenes.active?.id !== scene.id ) { await scene.activate(); await sleep(1500); }
    if ( canvas.scene?.id !== scene.id ) { await scene.view(); await sleep(1500); }
    await waitFor(() => canvas.ready);
    for ( const r of scene.regions.filter(r => r.getFlag(MOD, "emanation")?.kind === "spell") ) await r.delete().catch(() => {});

    const clrPost = { x: 1300, y: 600 };
    const far = { x: 2100, y: 1600 };
    await clrTok.update(clrPost, mv()); await vicTok.update(far, mv()); await sleep(600);
    const centre = { x: clrPost.x + grid / 2, y: clrPost.y + grid / 2 };

    const sgItem = cleric.items.find(i => i.name === "Spirit Guardians");
    const sgAct = [...(sgItem?.system?.activities ?? [])].find(a => a.type === "save");
    if ( !sgAct ) return { fatal: "BF Test Cleric has no Spirit Guardians save activity" };
    report.activity = { size: sgAct.target?.template?.size, type: sgAct.target?.template?.type, sizeSource: sgAct._source?.target?.template?.size ?? null, range: sgAct.range?.units, casterWidth: clrTok.width };
    try {
      await Promise.race([sgAct.use({ consume: { spellSlot: false, resources: false } }, { configure: false }, { create: true }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("use() did not settle")), 8000))]);
    } catch(err) { log(`use(): ${err.message}`); }
    template = await waitFor(() => scene.templates.find(t => t.getFlag("dnd5e", "origin") === sgAct.uuid) ?? null);
    region = await waitFor(() => { const r = scene.regions.find(r => r.getFlag(MOD, "emanation")?.kind === "spell" && r.getFlag(MOD, "emanation")?.key === "Spirit Guardians"); return r?.attachment?.token ? r : null; }) ?? scene.regions.find(r => r.getFlag(MOD, "emanation")?.kind === "spell");
    await sleep(1500);
    report.placed = {
      template: template ? { id: template.id, t: template.t, x: template.x, y: template.y, distance: template.distance, dims: template.getFlag("dnd5e", "dimensions") ?? null } : null,
      region: region ? { id: region.id, attached: region.attachment?.token?.id ?? null, shapes: region.shapes.map(s => ({ type: s.type, x: s.x, y: s.y, radiusX: s.radiusX, radiusY: s.radiusY, width: s.width, height: s.height })), members: [...(region.tokens ?? [])].map(t => t.name), elevation: region.elevation } : null,
      castDemandTargets: game.messages.contents.filter(x => (x.timestamp >= started) && x.getFlag(MOD, "saves")?.activityUuid === sgAct.uuid).map(m => m.getFlag(MOD, "saves")?.targets?.map(t => t.name) ?? [])
    };
    if ( !region ) throw new Error("no region adopted");

    // The two shapes that can disagree: the Region's (the platform's membership) and the DRAWN
    // template's (what `tokensInTemplates` reads when no honest dnd5e dimensions are stamped).
    const { tokensInTemplates } = await import("/modules/fvtt-mod-battleflow/scripts/geometry.js");
    report.gridTemplates = game.settings.get("core", "gridTemplates");
    report.drawnShape = template?.object?.shape?.constructor?.name ?? null;
    const drawnContains = p => { const s = template?.object?.shape; return s ? s.contains(p.x - template.x, p.y - template.y) : null; };
    const castCardFor = () => game.messages.contents.filter(x => (x.timestamp >= started) && x.getFlag(MOD, "saves") && !x.getFlag(MOD, "saves").pinnedTargets && x.getFlag(MOD, "saves").activityUuid === sgAct.uuid).at(-1) ?? null;
    const castTargets = () => castCardFor()?.getFlag(MOD, "saves")?.targets?.map(t => t.name) ?? [];
    const enterAsks = () => triggerCards().filter(m => m.getFlag(MOD, "emanationTrigger")?.targetUuid === vicTok.actor?.uuid && m.getFlag(MOD, "emanationTrigger")?.cause === "enter").length;

    // The grid of offsets (in squares) from the caster's square.
    const offsets = [[3, 0], [4, 0], [3, 1], [3, 2], [2, 2], [3, 3], [4, 1], [2, 3], [4, 2], [0, 4], [1, 4]];
    report.samples = [];
    for ( const [dx, dy] of offsets ) {
      const pos = { x: clrPost.x + dx * grid, y: clrPost.y + dy * grid };
      const n0 = enterAsks();
      await vicTok.update(pos, mv());
      await sleep(1800);
      const tokCentre = { x: pos.x + grid / 2, y: pos.y + grid / 2 };
      const euclid = Math.hypot(tokCentre.x - centre.x, tokCentre.y - centre.y) / grid * ft;
      let ruler = null; try { ruler = canvas.grid.measurePath([centre, tokCentre]).distance; } catch { /* older api */ }
      let inside = null; try { inside = region.testPoint({ x: tokCentre.x, y: tokCentre.y, elevation: vicTok.elevation }); } catch(err) { inside = `n/a: ${err.message}`; }
      report.samples.push({ squares: [dx, dy], euclidFt: Math.round(euclid * 100) / 100, rulerFt: ruler,
        regionMember: !!(region.tokens?.has?.(vicTok)), regionTestPoint: inside,
        drawnTemplateContains: drawnContains(tokCentre), moduleTokensInTemplate: (tokensInTemplates([template]) ?? []).map(t => t.name),
        halfSpeed: memberFx(vicTok.actor).length, saveAskedOnEnter: enterAsks() - n0, castDemandTargets: castTargets() });
      await vicTok.update(far, mv()); await sleep(1200);
    }

    // B. the RENDER floor: the victim just outside the Region at (3,3) — no member, no trigger —
    // then the cast's own demand card re-rendered. Does the cast's demand adopt the victim off
    // the drawn template?
    {
      const pos = { x: clrPost.x + 3 * grid, y: clrPost.y + 3 * grid };
      await vicTok.update(pos, mv()); await sleep(1500);
      const before = castTargets();
      const card = castCardFor();
      if ( card ) { await ui.chat.updateMessage(card, true); await sleep(2500); }
      report.renderFloor = { castCard: card?.id ?? null, status: card?.getFlag(MOD, "saves")?.status ?? null, regionMember: !!(region.tokens?.has?.(vicTok)), targetsBefore: before, targetsAfterRender: castTargets(), moduleTokensInTemplate: (tokensInTemplates([template]) ?? []).map(t => t.name) };
      await vicTok.update(far, mv()); await sleep(1000);
    }

    // C. ELEVATION: the Region's top is null — is a creature 30 ft up over the ring a member?
    {
      const pos = { x: clrPost.x + 3 * grid, y: clrPost.y };
      const n0 = enterAsks();
      await vicTok.update({ ...pos, elevation: 30 }, mv()); await sleep(1800);
      report.elevation = { squares: [3, 0], elevation: 30, regionMember: !!(region.tokens?.has?.(vicTok)), halfSpeed: memberFx(vicTok.actor).length, saveAskedOnEnter: enterAsks() - n0 };
      await vicTok.update({ ...far, elevation: 0 }, mv()); await sleep(1200);
    }

    // D. THE SWEEP: the victim parked 4 squares right (outside); the caster WALKS 8 squares right
    // past it in one move, ending 4 squares beyond — the ring crosses the victim mid-path and
    // ends with the victim outside. Is an entry asked?
    {
      const pos = { x: clrPost.x + 4 * grid, y: clrPost.y };
      await vicTok.update(pos, mv()); await sleep(1500);
      const n0 = enterAsks();
      const dest = { x: clrPost.x + 8 * grid, y: clrPost.y };
      await clrTok.update(dest, { animate: false }); await sleep(3000);
      report.sweep = { casterMovedTo: dest, regionMemberAfter: !!(region.tokens?.has?.(vicTok)), regionCentre: region.shapes.map(s => ({ x: s.x, y: s.y })), halfSpeed: memberFx(vicTok.actor).length, saveAskedOnEnter: enterAsks() - n0, cardsCause: triggerCards().slice(n0 ? -1 : 0).map(m => m.getFlag(MOD, "emanationTrigger")?.cause) };
      await vicTok.update(far, mv()); await sleep(800);
      await clrTok.update(clrPost, mv()); await sleep(1500);
    }

    // The wall: two squares to the right, a wall between.
    const wallPos = { x: clrPost.x + 2 * grid, y: clrPost.y };
    // A vertical wall one square right of the caster, three squares tall — total cover between
    // the caster's square and the spot two squares right.
    [wall] = await scene.createEmbeddedDocuments("Wall", [{ c: [clrPost.x + grid, clrPost.y - grid, clrPost.x + grid, clrPost.y + 2 * grid] }]);
    await sleep(300);
    {
      const n0 = triggerCards().length;
      await vicTok.update(wallPos, mv()); await sleep(1800);
      const tokCentre = { x: wallPos.x + grid / 2, y: wallPos.y + grid / 2 };
      let los = null; try { los = !CONFIG.Canvas.polygonBackends.sight.testCollision(centre, tokCentre, { type: "sight", mode: "any" }); } catch(err) { los = `n/a: ${err.message}`; }
      const cards = triggerCards().length - n0;
      const asked = triggerCards().slice(-cards).filter(m => m.getFlag(MOD, "emanationTrigger")?.targetUuid === vicTok.actor?.uuid && m.getFlag(MOD, "emanationTrigger")?.cause === "enter").length;
      let inside = null; try { inside = region.testPoint({ x: tokCentre.x, y: tokCentre.y, elevation: vicTok.elevation }); } catch(err) { inside = `n/a: ${err.message}`; }
      report.wall = { wallId: wall?.id ?? null, squares: [2, 0], lineOfSight: los, member: !!(region.tokens?.has?.(vicTok)), centreInside: inside, halfSpeed: memberFx(vicTok.actor).length, saveAsked: asked };
      await vicTok.update(far, mv()); await sleep(1000);
    }
    report.ok = true;
  } catch(err) {
    report.error = `${err?.message}\n${err?.stack}`;
  } finally {
    try { for ( const app of foundry.applications.instances.values() ) { if ( /RollConfigurationDialog/.test(app.constructor?.name ?? "") || app.element?.querySelector?.("[data-bf-save-demand]") ) await app.close().catch(() => {}); } } catch { /* gone */ }
    try { if ( wall && scene.walls.get(wall.id) ) await wall.delete(); } catch { /* gone */ }
    try { if ( template && scene.templates.get(template.id) ) await template.delete(); } catch { /* gone */ }
    try { if ( cleric.concentration?.effects?.size ) await cleric.endConcentration(); } catch { /* none */ }
    try { for ( const r of scene.regions.filter(r => r.getFlag(MOD, "emanation")?.kind === "spell") ) await r.delete().catch(() => {}); } catch { /* gone */ }
    try { for ( const [id, pos] of Object.entries(home) ) { const t = scene.tokens.get(id); if ( t ) await t.update(pos, mv()); } } catch { /* gone */ }
    await sleep(600);
    try { for ( const a of [victim, vicTok.actor, cleric].filter(Boolean) ) { const fx = a.effects.filter(e => e.getFlag(MOD, "emanation") || (e.getFlag(MOD, "mastery") === "rider" && /^Spirit Guardians/.test(e.name))).map(e => e.id).filter(id => a.effects.get(id)); if ( fx.length ) await a.deleteEmbeddedDocuments("ActiveEffect", fx).catch(() => {}); } } catch { /* gone */ }
    try { const mine = game.messages.filter(m => (m.timestamp >= started) && (m.speaker?.alias?.startsWith?.("BF Test") || m.speaker?.alias === "Battle Flow" || Object.keys(m.flags?.[MOD] ?? {}).length)); if ( mine.length ) await ChatMessage.deleteDocuments(mine.map(m => m.id)); } catch { /* gone */ }
    try { for ( const [k, v] of Object.entries(prior) ) await set(k, v); } catch(err) { log(`restore settings: ${err?.message}`); }
    try { const back = priorActiveScene ? game.scenes.get(priorActiveScene) : null; if ( back && (game.scenes.active?.id !== back.id) ) { await back.activate(); await sleep(1000); } } catch { /* fine */ }
  }
  return report;
});

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, TAG);
process.exit(0);
