// Probe (2026-09-03): EMANATIONS — what does the platform already do for an aura, before the
// module designs anything? The user's ruling opens DESIGN §4 to emanations (Paladin's aura is the
// example; the class is "a persistent area attached to a token whose effect applies to the tokens
// inside it"). The D10/D12 lesson says MEASURE first: the last time this repo reasoned about
// templates, Foundry 14 had silently moved the hooks.
//
// Four questions, each answered by reading rather than by inference:
//   1. DATA — how do the 2024 packs ship Aura of Protection / Aura of Courage / Spirit Guardians?
//      (activity type, target.template shape/size, effects carried, anything "emanation"-shaped)
//   2. PLACEMENT — using the activity, does a template land? Is it Region-backed? Does it FOLLOW
//      the caster's token when the token moves?
//   3. EVENTS — which hook names fire when another token enters / leaves the area, and does the
//      Region's own `tokens` set track membership? Can a module register a RegionBehavior type
//      through public API (CONFIG.RegionBehavior.dataModels)?
//   4. APPLICATION — does dnd5e 5.3 already apply anything to a token inside (an effect, a
//      bonus), or is that the gap?
//
// Read-only in effect: items added to the fixture, templates, regions and token moves are all
// undone in `finally`. Runs on the Battle Flow Test Range scene against the BF Test fixtures.
//
//   node tools/probe-emanations.mjs
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const TAG = "probe-emanations";
const f = await connectSuite({ tag: TAG, watchdogMs: 300_000, requireElect: false, env: loadEnv() });

const out = await f.evaluate(async () => {
  const report = { foundry: game.version, system: `${game.system.id} ${game.system.version}` };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ledger = globalThis.__bfHookLedger ?? null;
  const snap = () => (ledger ? { ...ledger } : {});
  const delta = (b, a) => Object.fromEntries(Object.keys(a).filter(k => (a[k] ?? 0) > (b[k] ?? 0)).map(k => [k, (a[k] ?? 0) - (b[k] ?? 0)]));

  /* --- 1: DATA ------------------------------------------------------------------------------ */
  const findPackItem = async (name, prefer = []) => {
    const packs = [...prefer.map(id => game.packs.get(id)).filter(Boolean),
      ...game.packs.filter(p => (p.documentName === "Item") && !prefer.includes(p.collection))];
    for ( const pack of packs ) {
      let index; try { index = await pack.getIndex(); } catch { continue; }
      const hit = index.find(e => e.name === name);
      if ( hit ) return { pack: pack.collection, doc: await pack.getDocument(hit._id) };
    }
    return null;
  };
  const describe = doc => {
    const s = doc.system;
    return {
      name: doc.name, type: doc.type, uuid: doc.uuid,
      level: s.level ?? null,
      duration: s.duration ? { value: s.duration.value, units: s.duration.units, concentration: s.duration.concentration ?? s.properties?.has?.("concentration") ?? null } : null,
      range: s.range ? { value: s.range.value, units: s.range.units } : null,
      target: s.target ? { affects: s.target.affects, template: s.target.template } : null,
      activities: [...(s.activities?.contents ?? [])].map(a => ({
        id: a.id, type: a.type, name: a.name,
        activation: a.activation ? { type: a.activation.type, value: a.activation.value } : null,
        target: a.target ? { affects: a.target.affects, template: a.target.template, prompt: a.target.prompt, override: a.target.override } : null,
        range: a.range ? { value: a.range.value, units: a.range.units, override: a.range.override } : null,
        duration: a.duration ? { value: a.duration.value, units: a.duration.units, override: a.duration.override } : null,
        save: a.save ? { ability: [...(a.save.ability ?? [])], dc: a.save.dc } : null,
        damage: a.damage?.parts?.map(p => ({ number: p.number, denomination: p.denomination, types: [...(p.types ?? [])], custom: p.custom?.formula ?? null })) ?? null,
        effects: a.effects?.map(e => ({ id: e._id, onSave: e.onSave ?? null })) ?? null,
        // anything the activity carries that smells like emanation/aura behaviour
        keys: Object.keys(a.toObject?.() ?? a).filter(k => !["_id", "type", "name", "img", "sort", "activation", "consumption", "description", "duration", "effects", "range", "target", "uses", "damage", "save", "roll", "healing", "attack"].includes(k))
      })),
      effects: doc.effects.map(e => ({
        name: e.name, transfer: e.transfer, disabled: e.disabled, statuses: [...e.statuses],
        duration: e.duration ? { seconds: e.duration.seconds, rounds: e.duration.rounds, turns: e.duration.turns } : null,
        changes: e.changes.map(c => `${c.key} ${["custom","multiply","add","downgrade","upgrade","override"][c.mode] ?? c.mode} ${c.value}`),
        flags: e.flags
      })),
      flags: doc.flags,
      descriptionHead: (s.description?.value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 420)
    };
  };
  const CLASSES = ["dnd-players-handbook.classes", "dnd5e.classfeatures24"];
  const SPELLS = ["dnd-players-handbook.spells", "dnd5e.spells24"];
  report.data = {};
  const want = [["Aura of Protection", CLASSES], ["Aura of Courage", CLASSES], ["Aura of Warding", CLASSES],
    ["Spirit Guardians", SPELLS], ["Aura of Vitality", SPELLS], ["Antilife Shell", SPELLS], ["Ashardalon's Stride", SPELLS]];
  const found = {};
  for ( const [name, prefer] of want ) {
    const hit = await findPackItem(name, prefer);
    report.data[name] = hit ? { pack: hit.pack, ...describe(hit.doc) } : null;
    if ( hit ) found[name] = hit.doc;
  }
  report.config = {
    areaTargetTypes: Object.fromEntries(Object.entries(CONFIG.DND5E.areaTargetTypes ?? {}).map(([k, v]) => [k, { label: game.i18n.localize(v.label ?? ""), template: v.template, sizes: v.sizes ?? null, standard: v.standard ?? null }])),
    areaTargetOptions: CONFIG.DND5E.areaTargetOptions ?? null,
    regionBehaviorTypes: Object.keys(CONFIG.RegionBehavior?.dataModels ?? {}),
    regionBehaviorTypeLabels: CONFIG.RegionBehavior?.typeLabels ?? null,
    regionEvents: CONST.REGION_EVENTS ?? null,
    regionHooksRegistered: Object.keys(Hooks.events ?? {}).filter(k => /region|Region|Template/.test(k)),
    templateDocumentClass: CONFIG.MeasuredTemplate?.documentClass?.name ?? null,
    regionDocumentClass: CONFIG.Region?.documentClass?.name ?? null
  };

  /* --- 2/3/4: BEHAVIOUR ------------------------------------------------------------------- */
  const scene = game.scenes.getName("Battle Flow Test Range");
  const caster = game.actors.getName("BF Test Rogue") ?? game.actors.getName("BF Test PC Attacker");
  const walker = game.actors.getName("BF Test Victim") ?? game.actors.getName("BF Test Ranger");
  report.live = { scene: scene?.name ?? null, caster: caster?.name ?? null, walker: walker?.name ?? null };
  if ( !scene || !caster || !walker ) { report.live.skipped = "fixtures missing"; return report; }
  if ( canvas.scene?.id !== scene.id ) { await scene.view(); await sleep(1500); }
  const casterTok = scene.tokens.find(t => t.actorId === caster.id);
  // The walker: the victim's token, or any other token on the scene that is not the caster's.
  const walkerTok = scene.tokens.find(t => t.actorId === walker.id) ?? scene.tokens.find(t => t.actor && (t.actorId !== caster.id));
  if ( walkerTok && (walkerTok.actorId !== walker.id) ) report.live.walker = `${walkerTok.name} (fallback token)`;
  // The native behaviour's schema — printed, so the attempt below is against the real shape.
  const aae = CONFIG.RegionBehavior?.dataModels?.applyActiveEffect;
  report.config.applyActiveEffectSchema = aae ? Object.fromEntries(Object.entries(aae.schema?.fields ?? {}).map(([k, v]) => [k, v.constructor?.name ?? String(v)])) : null;
  report.config.applyActiveEffectEvents = aae?.events ? Object.keys(aae.events) : (aae?.schema?.fields?.events ? "events field" : null);
  report.live.tokens = { caster: casterTok ? { x: casterTok.x, y: casterTok.y } : null, walker: walkerTok ? { x: walkerTok.x, y: walkerTok.y } : null };
  if ( !casterTok || !walkerTok ) { report.live.skipped = "tokens missing"; return report; }
  const origin = { caster: { x: casterTok.x, y: casterTok.y }, walker: { x: walkerTok.x, y: walkerTok.y } };
  const grid = scene.grid.size, feet = scene.grid.distance;
  // ⚠ A headless page has no token animation context: a plain positional update threw inside
  // Foundry's movement-path builder. Teleport, no animation.
  // ⚠ A FRESH options object per update: Foundry defines a per-token property on it
  // (#preUpdateMovement), and a reused object throws "Cannot redefine property".
  const mv = () => ({ teleport: true, animate: false });
  // A data model or placeable read back raw carries cycles (PIXI events) — flatten to JSON-safe.
  const safe = x => { const seen = new WeakSet(); try { return JSON.parse(JSON.stringify(x?.toObject?.() ?? x, (k, v) => {
    if ( v && (typeof v === "object") ) { if ( seen.has(v) ) return "[cycle]"; seen.add(v); if ( v.documentName ) return `[${v.documentName} ${v.id}]`; if ( v._events ) return `[${v.constructor?.name}]`; }
    return v; })); } catch (e) { return `[unserializable: ${e.message}]`; } };
  report.config.regionAttachmentSchema = (() => { const f = CONFIG.Region?.documentClass?.schema?.fields?.attachment; return f ? { type: f.constructor?.name, fields: Object.fromEntries(Object.entries(f.fields ?? {}).map(([k, v]) => [k, v.constructor?.name])) } : null; })();
  report.live.grid = { size: grid, distance: feet, units: scene.grid.units };

  // Sweep what an ABORTED earlier run may have left: the probe's items on the caster, templates
  // those items placed, and any region behaviour the probe named.
  {
    const names = new Set(want.map(([n]) => n));
    const stale = caster.items.filter(i => names.has(i.name));
    if ( stale.length ) await caster.deleteEmbeddedDocuments("Item", stale.map(i => i.id));
    const staleT = scene.templates.filter(t => String(t.flags?.dnd5e?.item ?? t.flags?.dnd5e?.origin ?? "").startsWith(caster.uuid));
    if ( staleT.length ) await scene.deleteEmbeddedDocuments("MeasuredTemplate", staleT.map(t => t.id));
    for ( const g of scene.regions ) { const b = g.behaviors.filter(x => x.name === "probe"); if ( b.length ) await g.deleteEmbeddedDocuments("RegionBehavior", b.map(x => x.id)); }
    report.live.swept = { items: stale.length, templates: staleT.length };
    await sleep(400);
  }
  const added = []; const madeTemplates = new Set(); const madeRegions = new Set();
  const tplBefore = new Set(scene.templates.map(t => t.id)), regBefore = new Set(scene.regions.map(r => r.id));
  const newTemplates = () => scene.templates.filter(t => !tplBefore.has(t.id));
  const newRegions = () => scene.regions.filter(r => !regBefore.has(r.id));
  const tplView = t => ({ id: t.id, t: t.t, x: t.x, y: t.y, distance: t.distance, author: t.author?.name ?? null, flags: t.flags,
    keys: Object.keys(t.toObject()).filter(k => !["_id","t","x","y","elevation","sort","distance","direction","angle","width","borderColor","fillColor","texture","hidden","flags","author"].includes(k)),
    extra: Object.fromEntries(Object.entries(t.toObject()).filter(([k]) => !["_id","t","x","y","elevation","sort","distance","direction","angle","width","borderColor","fillColor","texture","hidden","flags","author"].includes(k))) });
  const regView = r => ({ id: r.id, name: r.name, shapes: r.shapes.map(s => ({ type: s.type, x: s.x, y: s.y, radiusX: s.radiusX, radiusY: s.radiusY })),
    behaviors: r.behaviors.map(b => ({ type: b.type, name: b.name, disabled: b.disabled, system: b.system?.toObject?.() ?? null })),
    tokens: [...(r.tokens ?? [])].map(t => t.name), flags: r.flags, visibility: r.visibility,
    keys: Object.keys(r.toObject()).filter(k => !["_id","name","color","shapes","elevation","behaviors","visibility","locked","flags"].includes(k)) });
  // ⚠ The walker's token may be UNLINKED — read the TOKEN's actor, where an applied effect lands.
  const effectsOf = a => (a?.effects ?? []).map(e => ({ name: e.name, origin: e.origin, disabled: e.disabled, transfer: e.transfer, changes: e.changes.map(c => `${c.key} ${c.mode} ${c.value}`) }));
  const walkerActor = () => walkerTok.actor ?? walker;
  report.live.walkerToken = { name: walkerTok.name, linked: walkerTok.actorLink, id: walkerTok.id };
  report.config.regionShapeTypes = CONST.REGION_SHAPE_TYPES ?? null;
  // Foundry 14's own emanation constructor (foundryvtt#13640) — does it exist here, and what does it take?
  const RD = CONFIG.Region.documentClass;
  report.config.createTokenEmanation = (typeof RD.createTokenEmanation === "function") ? RD.createTokenEmanation.toString().slice(0, 900) : null;
  report.config.regionDocStatics = Object.getOwnPropertyNames(RD).filter(k => typeof RD[k] === "function");
  report.config.tokenEmanationMethods = Object.getOwnPropertyNames(CONFIG.Token.documentClass.prototype).filter(k => /[Ee]manation|[Rr]egion/.test(k));

  const runOne = async (label, doc) => {
    const r = { label };
    try {
      const data = doc.toObject(); delete data._id;
      const [item] = await caster.createEmbeddedDocuments("Item", [data]); added.push(item);
      r.itemEffectsOnCaster = effectsOf(caster).filter(e => e.origin === item.uuid);
      const act = item.system.activities?.contents?.[0] ?? null;
      r.activity = act ? { type: act.type, target: act.target?.template } : null;
      r.itemEffects = item.effects.map(e => ({ name: e.name, transfer: e.transfer, uuid: e.uuid, changes: e.changes.map(c => `${c.key} ${c.mode} ${c.value}`) }));
      // Use it — no dialog. A spell needs a slot; the Rogue has none, so allow a slot-less cast.
      const b1 = snap();
      if ( act ) try {
        // ⚠ NEVER let the platform place the template here: a `prompt: true` emanation waits on
        // a canvas click that no headless run will make (the first live run hung 300 s on it).
        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("use() did not settle in 8 s")), 8000));
        const res = await Promise.race([act.use({ consume: { spellSlot: false, resources: false }, create: { measuredTemplate: false } }, { configure: false }, { create: true }), timeout]);
        r.useReturnedKeys = res ? Object.keys(res) : null;
      } catch (e) { r.useError = String(e?.message ?? e); }
      await sleep(900);
      r.onUse = delta(b1, snap());
      r.templatesAfterUse = newTemplates().map(tplView);
      r.regionsAfterUse = newRegions().map(regView);
      for ( const t of newTemplates() ) madeTemplates.add(t.id);
      for ( const g of newRegions() ) madeRegions.add(g.id);
      // If the activity made no template, place one BY HAND the way the system would (a
      // circle/emanation at the caster), so the region questions still get an answer.
      if ( !r.templatesAfterUse.length ) {
        const size = act?.target?.template?.size ? Number(act.target.template.size) : 10;
        const b = snap();
        const [t] = await scene.createEmbeddedDocuments("MeasuredTemplate", [{ t: "circle", x: casterTok.x + (casterTok.width * grid) / 2, y: casterTok.y + (casterTok.height * grid) / 2, distance: size,
          flags: { dnd5e: { origin: act?.uuid ?? item.uuid, item: item.uuid, spellLevel: item.system.level ?? null } } }]);
        await sleep(600);
        r.handPlaced = { onCreate: delta(b, snap()), template: tplView(t) };
        for ( const nt of newTemplates() ) madeTemplates.add(nt.id);
        for ( const g of newRegions() ) madeRegions.add(g.id);
        r.regionsAfterHandPlace = newRegions().map(regView);
      }
      const tpl = newTemplates()[0] ?? null; const reg = newRegions()[0] ?? null;
      if ( !tpl ) return r;
      // 2: does it FOLLOW the caster? First as placed; then with the region ATTACHED to the token
      // through the platform's own `attachment` field, if that field takes a token.
      r.regionAttachmentAsPlaced = reg ? safe(reg.attachment ?? null) : null;
      const moveCaster = async () => {
        const before = { x: scene.templates.get(tpl.id)?.x, y: scene.templates.get(tpl.id)?.y };
        const b2 = snap();
        // ⚠ Move UP two squares (x=900 is the Attacker's square; the first run's move never landed)
        let moveError = null;
        try { await casterTok.update({ y: origin.caster.y - 2 * grid }, mv()); } catch (e) { moveError = String(e?.message ?? e); }
        await sleep(900);
        const after = { x: scene.templates.get(tpl.id)?.x, y: scene.templates.get(tpl.id)?.y };
        const out = { moveError, tokenAfter: { x: scene.tokens.get(casterTok.id)?.x, y: scene.tokens.get(casterTok.id)?.y }, tokenMoved: scene.tokens.get(casterTok.id)?.y !== origin.caster.y,
          hooks: delta(b2, snap()), templateBefore: before, templateAfter: after, followed: (after.x !== before.x) || (after.y !== before.y),
          regionShapeAfter: reg ? scene.regions.get(reg.id)?.shapes.map(s => ({ x: s.x, y: s.y, radiusX: s.radiusX })) : null,
          regionTokensAfter: reg ? [...(scene.regions.get(reg.id)?.tokens ?? [])].map(t => t.name) : null };
        await casterTok.update({ y: origin.caster.y }, mv()); await sleep(600);
        return out;
      };
      r.casterMoved = await moveCaster();
      if ( reg && !r.casterMoved.followed ) {
        r.attachAttempt = {};
        for ( const att of [{ token: casterTok.id }, { tokenId: casterTok.id }, { uuid: casterTok.uuid }, { type: "token", token: casterTok.id }] ) {
          try { await reg.update({ attachment: att }); r.attachAttempt.accepted = { tried: att, now: safe(reg.attachment) }; break; }
          catch (e) { (r.attachAttempt.errors ??= []).push({ tried: att, error: String(e?.message ?? e) }); }
        }
        if ( r.attachAttempt.accepted ) { await sleep(400); r.casterMovedAttached = await moveCaster(); }
      }
      // 3: walk another token IN, then OUT. Membership and hook names.
      const t2 = scene.templates.get(tpl.id);
      const inside = { x: t2.x - (walkerTok.width * grid) / 2, y: t2.y - (walkerTok.height * grid) / 2 + grid };
      // ⚠ IN BOUNDS: the scene is 2000 px square; the first "far" (t2 + 12 squares) was off it and
      // the move was refused, which made the exit reading a lie.
      const far = { x: 1300, y: 1400 };
      const reg2 = reg ? scene.regions.get(reg.id) : null;
      const walkerEffectsBefore = effectsOf(walkerActor());
      const memberIds = g => g ? [...(g.tokens ?? [])].map(t => `${t.name}#${t.id}`) : null;
      const b3 = snap();
      await walkerTok.update(far, mv()); await sleep(700);
      r.walkerFar = { hooks: delta(b3, snap()), regionTokens: memberIds(reg2) };
      const b4 = snap();
      await walkerTok.update(inside, mv()); await sleep(900);
      r.walkerEntered = { hooks: delta(b4, snap()), regionTokens: memberIds(reg2),
        walkerEffectsNew: effectsOf(walkerActor()).filter(e => !walkerEffectsBefore.some(w => w.name === e.name && w.origin === e.origin)),
        walkerBonusesAbilitySave: walkerActor().system.bonuses?.abilities?.save ?? null };
      // 4b: a turn start inside — does anything trigger? (no combat here; note it)
      const b5 = snap();
      await walkerTok.update(far, mv()); await sleep(900);
      r.walkerLeft = { hooks: delta(b5, snap()), regionTokens: memberIds(reg2),
        walkerEffectsNew: effectsOf(walkerActor()).filter(e => !walkerEffectsBefore.some(w => w.name === e.name && w.origin === e.origin)) };
      await walkerTok.update(origin.walker, mv()); await sleep(300);
      // the region's behaviour list and whether a token INSIDE at creation is a member
      r.regionFinal = reg2 ? regView(reg2) : null;
      // 4: the PLATFORM's own answer — an applyActiveEffect behaviour on the template's region,
      // pointing at the item's effect. If this lands the effect on a token walking in and lifts
      // it on the way out, the module's whole job is to put this row there.
      if ( reg2 && item.effects.size ) {
        const eff = item.effects.contents[0];
        r.nativeBehavior = { effect: eff.name, effectUuid: eff.uuid };
        const shapes = [{ effects: [eff.uuid] }, { effect: eff.uuid }, { uuid: eff.uuid }, { effects: [eff.id] }];
        for ( const sys of shapes ) {
          try {
            const [beh] = await reg2.createEmbeddedDocuments("RegionBehavior", [{ type: "applyActiveEffect", name: "probe", system: sys }]);
            r.nativeBehavior.created = { system: beh.system?.toObject?.() ?? beh.system, tried: sys };
            break;
          } catch (e) { (r.nativeBehavior.errors ??= []).push({ tried: sys, error: String(e?.message ?? e) }); }
        }
        if ( r.nativeBehavior.created ) {
          await sleep(300);
          const wb = effectsOf(walkerActor());
          const fresh = () => effectsOf(walkerActor()).filter(e => !wb.some(w => (w.name === e.name) && (w.origin === e.origin)));
          const b6 = snap();
          await walkerTok.update(inside, mv()); await sleep(1000);
          r.nativeBehavior.casterSelf = { effectsFromRegion: effectsOf(caster).filter(e => /RegionBehavior/.test(e.origin ?? "")), transferOnItem: item.effects.filter(e => e.transfer).map(e => e.name) };
          r.nativeBehavior.entered = { hooks: delta(b6, snap()), effectsNew: fresh(), members: memberIds(reg2),
            walkerBonusesAbilitySave: walkerActor().system.bonuses?.abilities?.save ?? null,
            // ⚠ THE FORMULA QUESTION: "Protected" adds @abilities.cha.mod — whose Charisma did the walker get?
            walkerSaveMod: { wis: walkerActor().system.abilities?.wis?.save?.value ?? walkerActor().system.abilities?.wis?.save ?? null, walkerCha: walkerActor().system.abilities?.cha?.mod ?? null, casterCha: caster.system.abilities?.cha?.mod ?? null },
            speed: walkerActor().system.attributes?.movement?.walk ?? null };
          const b7 = snap();
          await walkerTok.update(far, mv()); await sleep(1000);
          r.nativeBehavior.left = { hooks: delta(b7, snap()), effectsNew: fresh(), members: memberIds(reg2), speed: walkerActor().system.attributes?.movement?.walk ?? null };
          // and a token already INSIDE when the behaviour appears: move in first, then toggle it
          await walkerTok.update(inside, mv()); await sleep(600);
          const beh = reg2.behaviors.find(b => b.name === "probe");
          await beh.update({ disabled: true }); await sleep(500);
          const wb2 = effectsOf(walkerActor());
          r.nativeBehavior.disabledWhileInside = { effectsLeft: fresh() };
          await beh.update({ disabled: false }); await sleep(800);
          r.nativeBehavior.enabledWhileInside = { effectsNew: effectsOf(walkerActor()).filter(e => !wb2.some(w => (w.name === e.name) && (w.origin === e.origin))) };
          // the emanation MOVING onto a standing token: drag the region's attached token so the area covers the walker
          await walkerTok.update(far, mv()); await sleep(500);
          const b8 = snap();
          let dragError = null;
          // the caster lands one square left of the walker — the 10 ft area covers it
          try { await casterTok.update({ x: far.x - grid, y: far.y }, mv()); } catch (e) { dragError = String(e?.message ?? e); }
          await sleep(1000);
          r.nativeBehavior.areaMovedOntoWalker = { dragError, hooks: Object.keys(delta(b8, snap())).filter(h => /Effect|Region|Token/.test(h)), casterAt: { x: scene.tokens.get(casterTok.id)?.x, y: scene.tokens.get(casterTok.id)?.y },
            regionShape: scene.regions.get(reg2.id)?.shapes.map(s => ({ x: s.x, y: s.y })), members: memberIds(reg2), effectsNew: fresh() };
          await casterTok.update(origin.caster, mv()); await sleep(600);
          await walkerTok.update(origin.walker, mv()); await sleep(600);
          r.nativeBehavior.afterReturn = { effectsLeft: fresh(), members: memberIds(reg2) };
        }
      }
    } catch (e) { r.error = `${e?.message ?? e}\n${e?.stack ?? ""}`; }
    // ⚠ Per-run teardown, so the next run gets its OWN area (run 2 reused run 1's template before this).
    try { for ( const t of newTemplates() ) await t.delete(); } catch {}
    try { for ( const g of newRegions() ) await g.delete(); } catch {}
    try { const stray = walkerActor().effects.filter(e => e.origin && added.some(i => e.origin.startsWith(i.uuid))); if ( stray.length ) await walkerActor().deleteEmbeddedDocuments("ActiveEffect", stray.map(e => e.id)); } catch {}
    await sleep(400);
    return r;
  };
  // Foundry's own emanation, if the API is there: attach a 10 ft emanation to the caster and move.
  report.tokenEmanation = {};
  if ( typeof RD.createTokenEmanation === "function" ) {
    let made = null;
    try {
      for ( const args of [[casterTok, 10, { name: "probe emanation" }], [casterTok, 10, { name: "probe emanation" }, { excludeToken: true }]] ) {
        try { made = await RD.createTokenEmanation(...args); report.tokenEmanation.tried = safe(args.slice(1)); report.tokenEmanation.returned = made ? (made.documentName ?? typeof made) : String(made); if ( made ) break; }
        catch (e) { (report.tokenEmanation.errors ??= []).push({ tried: safe(args.slice(1)), error: String(e?.message ?? e) }); }
      }
      if ( made ) {
        const g = scene.regions.get(made.id) ?? made;
        report.tokenEmanation.region = { id: g.id, name: g.name, shapes: safe(g.shapes.map(s => s.toObject?.() ?? s)), elevation: safe(g.elevation), attachment: safe(g.attachment)?.token?._id ?? safe(g.attachment), behaviors: g.behaviors.map(b => b.type), members: [...(g.tokens ?? [])].map(t => t.name) };
        const shapeBefore = safe(g.shapes.map(s => s.toObject?.() ?? s));
        await casterTok.update({ y: origin.caster.y - 2 * grid }, mv()); await sleep(900);
        report.tokenEmanation.afterCasterMove = { tokenY: scene.tokens.get(casterTok.id)?.y, shapeBefore, shapeAfter: safe(g.shapes.map(s => s.toObject?.() ?? s)), members: [...(g.tokens ?? [])].map(t => t.name) };
        await casterTok.update(origin.caster, mv()); await sleep(600);
        // The whole design in one test: the platform's emanation + the platform's behaviour, and the
        // AREA moves onto a standing token (the token did not move — did tokenEnter fire for it?).
        const aop = found["Aura of Protection"];
        if ( aop ) {
          const data = aop.toObject(); delete data._id;
          const [item] = await caster.createEmbeddedDocuments("Item", [data]); added.push(item);
          const eff = item.effects.contents[0];
          await g.createEmbeddedDocuments("RegionBehavior", [{ type: "applyActiveEffect", name: "probe", system: { effects: [eff.uuid] } }]);
          await sleep(300);
          const wa = () => walkerTok.actor ?? walker;
          const base = effectsOf(wa());
          const fresh2 = () => effectsOf(wa()).filter(e => !base.some(w => (w.name === e.name) && (w.origin === e.origin)));
          const far2 = { x: 1300, y: 1400 };
          await walkerTok.update(far2, mv()); await sleep(600);
          report.tokenEmanation.walkerStanding = { at: far2, effects: fresh2(), members: [...(g.tokens ?? [])].map(t => t.name) };
          const b9 = snap();
          await casterTok.update({ x: far2.x - grid, y: far2.y }, mv()); await sleep(1000);
          report.tokenEmanation.areaMovedOntoWalker = { hooks: Object.keys(delta(b9, snap())).filter(h => /Effect|Region|Token/.test(h)), casterAt: { x: scene.tokens.get(casterTok.id)?.x, y: scene.tokens.get(casterTok.id)?.y },
            members: [...(g.tokens ?? [])].map(t => t.name), effects: fresh2(), casterSelf: effectsOf(caster).filter(e => /RegionBehavior/.test(e.origin ?? "")).map(e => e.name) };
          const b10 = snap();
          await casterTok.update(origin.caster, mv()); await sleep(1000);
          report.tokenEmanation.areaMovedAway = { hooks: Object.keys(delta(b10, snap())).filter(h => /Effect|Region/.test(h)), members: [...(g.tokens ?? [])].map(t => t.name), effects: fresh2() };
          await walkerTok.update(origin.walker, mv()); await sleep(400);
        }
      }
    } catch (e) { report.tokenEmanation.error = String(e?.message ?? e); }
    finally { try { if ( made ) await (scene.regions.get(made.id) ?? made).delete(); } catch {} }
  }

  report.runs = [];
  try {
    for ( const name of ["Aura of Protection", "Spirit Guardians"] ) {
      if ( found[name] ) report.runs.push(await runOne(name, found[name]));
      else report.runs.push({ label: name, skipped: "not found in any pack" });
    }
  } finally {
    try { for ( const id of madeTemplates ) { const t = scene.templates.get(id); if ( t ) await t.delete(); } } catch {}
    try { for ( const id of madeRegions ) { const g = scene.regions.get(id); if ( g ) await g.delete(); } } catch {}
    try { if ( added.length ) await caster.deleteEmbeddedDocuments("Item", added.map(i => i.id).filter(id => caster.items.has(id))); } catch {}
    try { await casterTok.update(origin.caster, mv()); await walkerTok.update(origin.walker, mv()); } catch {}
    // any effect the run left on the walker or caster from the probe's items
    try { const stray = walker.effects.filter(e => added.some(i => e.origin?.startsWith?.(i.uuid))); if ( stray.length ) await walker.deleteEmbeddedDocuments("ActiveEffect", stray.map(e => e.id)); } catch {}
    report.cleanup = { templatesLeft: newTemplates().length, regionsLeft: newRegions().length, itemsLeft: added.filter(i => caster.items.has(i.id)).length };
  }
  return report;
});

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, TAG);
process.exit(0);
