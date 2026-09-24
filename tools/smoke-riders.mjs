// Battle Flow Phase 1.75 smoke test — hit riders, driven in the live world through the bridge.
//
// What this has to prove is narrow and load-bearing: a mark pays out ONLY for the creature that
// placed it, only when the table lists it, and for exactly what its own content says. Every
// assertion below is a way of getting that wrong.
//
// Damage rolls use create:false throughout, so nothing reaches the chat log and no HP moves.
// Fixtures are LINKED tokens created here and deleted on the way out — an unlinked token's
// synthetic actor has a different uuid from its base actor, which is precisely the distinction
// the ownership test turns on, so leaving that ambiguous would make a passing suite meaningless.
//
// Sections (PLAN 1.1): `--section 5`, `--section 1,8`, `--list`. Fixtures and teardown ALWAYS
// run; only the numbered assertion blocks are skippable.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs): the machines this suite drives — a change to one
// re-runs it under `battery.mjs --changed`. Spine files are never claimed: their change is the
// full battery. `npm run coverage` checks the claims both ways. Exported only so the linter reads
// it as the declaration it is: ⚠ NEVER import a suite (it connects on evaluation) — the map is parsed.
export const COVERS = [
  'hit-riders.js'           // the mark pays out — ownership, crit, the list, the toggle, Foe Slayer
];

const SECTIONS = {
  1: 'the rider rides',
  2: 'crit doubles it',
  3: 'the list gates it',
  4: 'the toggle gates it',
  5: "SOMEONE ELSE'S mark",
  6: 'no mark at all',
  7: 'concentration origin',
  8: 'Foe Slayer REPLACES',
  9: "the tray's shape: a stale compendium item beside a fresh activity",
  10: 'through the cast: the applier names the caster'
};
// §§2-4 re-roll against the mark §1 placed and never place one of their own — the coupling is
// real, so asking for any of them runs §1 first.
const DEPENDS = { 2: ['1'], 3: ['1'], 4: ['1'] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'riders', watchdogMs: 300_000 });
announcePlan('riders', plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = 'fvtt-mod-battleflow';
  const results = [];
  const log = [];
  const skips = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  // The section gate — see tools/harness.mjs. This closure is serialized into the page, so the
  // plan and the titles arrive as DATA and the predicate is spelled out here.
  const want = id => {
    if (!sections || sections.includes(String(id))) return true;
    skips.push(`§${id} ${titles?.[id] ?? ''}`);
    return false;
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  for (const key of ['riders', 'riderList', 'riderUpgrades']) {
    if (!game.settings.settings.has(`${MOD}.${key}`)) {
      return { fatal: `setting ${key} not registered — this client is running OLD code (F5)` };
    }
  }

  const prior = {
    riders: game.settings.get(MOD, 'riders'),
    riderList: game.settings.get(MOD, 'riderList'),
    riderUpgrades: game.settings.get(MOD, 'riderUpgrades'),
    // §10 casts through the cast slice; the settings it pins come back with the rest.
    castApply: game.settings.get(MOD, 'castApply'),
    dramaticBeat: game.settings.get(MOD, 'dramaticBeat'),
    reactionHold: game.settings.get(MOD, 'reactionHold'),
  };

  const scene = game.scenes.getName('Battle Flow Test Range');
  const attacker = game.actors.getName('BF Test Attacker');
  const victim = game.actors.getName('BF Test Victim');
  const bystander = game.actors.getName('BF Test Shielder'); // stands in as a SECOND marker
  if (!scene || !attacker || !victim || !bystander) {
    return { fatal: 'missing fixture: scene "Battle Flow Test Range" or a BF Test actor' };
  }

  const created = { items: [], effects: [], tokens: [], messages: [] };
  // §10's edits to a fixture item that may pre-date this run: put back exactly as found.
  const itemRestores = [];
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    for (const { item, effect, data } of itemRestores.reverse()) {
      if (!item?.parent?.items.get(item.id)) continue;
      if (effect) await item.updateEmbeddedDocuments('ActiveEffect', [{ _id: effect, ...data }]);
      else await item.update(data);
    }
    const liveMessages = created.messages.filter(id => game.messages.get(id));
    if (liveMessages.length) await ChatMessage.deleteDocuments(liveMessages);
    // ⚠ A synthetic actor rebuilds its embedded collections from the delta on every write, so
    // deletions go out as ONE call per collection, never one document at a time.
    for (const [actorId, ids] of Object.entries(created.effects.reduce((m, e) => {
      (m[e.actorId] ??= []).push(e.id); return m;
    }, {}))) {
      const a = game.actors.get(actorId);
      const live = ids.filter(id => a?.effects.get(id));
      if (live.length) await a.deleteEmbeddedDocuments('ActiveEffect', live);
    }
    for (const [actorId, ids] of Object.entries(created.items.reduce((m, i) => {
      (m[i.actorId] ??= []).push(i.id); return m;
    }, {}))) {
      const a = game.actors.get(actorId);
      const live = ids.filter(id => a?.items.get(id));
      if (live.length) await a.deleteEmbeddedDocuments('Item', live);
    }
    const liveTokens = created.tokens.filter(id => scene.tokens.get(id));
    if (liveTokens.length) await scene.deleteEmbeddedDocuments('Token', liveTokens);
    game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
    for (const [k, v] of Object.entries(prior)) await game.settings.set(MOD, k, v);
  };

  try {
    await game.settings.set(MOD, 'riders', true);
    await game.settings.set(MOD, 'riderList', 'hunters-mark, hex, great-old-one-hex');
    await game.settings.set(MOD, 'riderUpgrades', 'foe-slayer:hunters-mark');

    // ---- fixtures: Hunter's Mark on the attacker, and on the bystander for the ownership test
    // ⚠ An identifier is NOT unique across rule versions. `dnd5e.spells` (2014) ships a
    // Hunter's Mark with identifier "hunters-mark" and NO bonus-damage activity — the separate
    // "Bonus Mark Damage" press is a 2024 modelling. Picking the first identifier match found
    // the 2014 item, riderParts correctly read nothing off it, and every positive assertion
    // failed while every negative passed vacuously. Select on the rider SHAPE, so the fixture
    // can only ever be an item that is actually capable of riding.
    const hasRiderActivity = doc => [...(doc.system?.activities ?? [])].some(a =>
      (a.type === 'damage') && a.activation?.override && !a.activation?.type
      && (a.damage?.parts?.length));
    const findInPacks = async identifier => {
      for (const pack of game.packs) {
        if (pack.documentName !== 'Item') continue;
        if (pack.metadata.id.startsWith('JB2A')) continue;
        let index;
        try { index = await pack.getIndex({ fields: ['system.identifier'] }); } catch { continue; }
        for (const entry of index.filter(e => e.system?.identifier === identifier)) {
          const doc = await pack.getDocument(entry._id);
          if (hasRiderActivity(doc)) return doc;
        }
      }
      return null;
    };
    const grant = async (actor, identifier) => {
      const existing = actor.items.find(i => i.system?.identifier === identifier);
      if (existing) return existing;
      const doc = await findInPacks(identifier);
      if (!doc) return null;
      const [made] = await actor.createEmbeddedDocuments('Item', [doc.toObject()]);
      created.items.push({ actorId: actor.id, id: made.id });
      return made;
    };

    const hmAttacker = await grant(attacker, 'hunters-mark');
    const hmBystander = await grant(bystander, 'hunters-mark');
    if (!hmAttacker || !hmBystander) return { fatal: 'hunters-mark not found in any compendium' };
    log.push(`attacker mark item: ${hmAttacker.name}`);

    const markerTemplate = hmAttacker.effects.find(e => e.name === "Hunter's Mark")
      ?? hmAttacker.effects.contents[0];
    if (!markerTemplate) return { fatal: "Hunter's Mark ships no marker effect" };

    const weapon = attacker.items.find(i => i.system?.activities?.some?.(a => a.type === 'attack'));
    const activity = () => attacker.items.get(weapon.id).system.activities.find(a => a.type === 'attack');
    if (!weapon) return { fatal: 'BF Test Attacker has no attack activity' };
    log.push(`weapon: ${weapon.name}`);

    // ---- LINKED tokens, so token.actor IS the base actor and the uuid test is unambiguous
    if (canvas.scene?.id !== scene.id) await scene.view();
    const tokenFor = async actor => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(
        actor.prototypeToken.toObject(),
        { x: 1200 + (created.tokens.length * 200), y: 1600, actorId: actor.id, actorLink: true },
        { inplace: false })]);
      created.tokens.push(doc.id);
      return doc;
    };
    const victimTokenDoc = await tokenFor(victim);
    await sleep(400);
    const victimToken = canvas.tokens.get(victimTokenDoc.id);
    if (!victimToken) return { fatal: 'victim token never reached the canvas' };

    // ---- helpers
    const putMark = async (originUuid, extra = {}) => {
      const [made] = await victim.createEmbeddedDocuments('ActiveEffect', [foundry.utils.mergeObject({
        ...markerTemplate.toObject(), disabled: false, transfer: false, origin: originUuid
      }, extra)]);
      created.effects.push({ actorId: victim.id, id: made.id });
      return made;
    };
    const clearMarks = async () => {
      const mine = created.effects.filter(e => e.actorId === victim.id && victim.effects.get(e.id));
      if (mine.length) await victim.deleteEmbeddedDocuments('ActiveEffect', mine.map(e => e.id));
      created.effects = created.effects.filter(e => !mine.includes(e));
    };
    const rollAt = async (isCritical = false) => {
      victimToken.setTarget(true, { releaseOthers: true });
      await sleep(80);
      const rolls = await activity().rollDamage({ isCritical }, { configure: false }, { create: false });
      return (rolls ?? []).map(r => ({ formula: r.formula, type: r.options?.type ?? null }));
    };
    const forceParts = rolls => rolls.filter(r => r.type === 'force');

    // The origin shape observed on a REAL mark in this world: the source item's own effect.
    const itemOrigin = `${hmAttacker.uuid}.ActiveEffect.${markerTemplate.id}`;

    // The roll readout, out here rather than in §1: every section below re-rolls into it.
    let rolls;

    // ---------------------------------------------------------------- 1. the rider rides
    if (want(1)) {
      await putMark(itemOrigin);
      rolls = await rollAt();
      ok('1. marked target gets the rider', forceParts(rolls).length === 1
        && forceParts(rolls)[0].formula === '1d6', JSON.stringify(rolls));
    }

    // ---------------------------------------------------------------- 2. crit doubles it
    if (want(2)) {
      rolls = await rollAt(true);
      ok('2. crit doubles the rider (no code does this)', forceParts(rolls)[0]?.formula === '2d6',
        JSON.stringify(rolls));
    }

    // ---------------------------------------------------------------- 3. the list gates it
    if (want(3)) {
      await game.settings.set(MOD, 'riderList', 'hex');
      rolls = await rollAt();
      ok('3. a mark the table does not list pays nothing', forceParts(rolls).length === 0,
        JSON.stringify(rolls));
      await game.settings.set(MOD, 'riderList', 'hunters-mark, hex, great-old-one-hex');
    }

    // ---------------------------------------------------------------- 4. the toggle gates it
    if (want(4)) {
      await game.settings.set(MOD, 'riders', false);
      rolls = await rollAt();
      ok('4. feature off pays nothing', forceParts(rolls).length === 0, JSON.stringify(rolls));
      await game.settings.set(MOD, 'riders', true);
    }

    // ---------------------------------------------------------------- 5. SOMEONE ELSE'S mark
    if (want(5)) {
      // The property the whole feature turns on. Two rangers can mark one creature; each may add
      // only their own die. A test that only ever checks "is there a mark" passes this by luck.
      await clearMarks();
      await putMark(`${hmBystander.uuid}.ActiveEffect.${markerTemplate.id}`);
      rolls = await rollAt();
      ok("5. another creature's mark pays this attacker nothing", forceParts(rolls).length === 0,
        JSON.stringify(rolls));
    }

    // ---------------------------------------------------------------- 6. no mark at all
    if (want(6)) {
      await clearMarks();
      rolls = await rollAt();
      ok('6. an unmarked target pays nothing', forceParts(rolls).length === 0, JSON.stringify(rolls));
    }

    // ---------------------------------------------------------------- 7. concentration origin
    if (want(7)) {
      // The tray writes `origin = concentration ?? effect`, so the OTHER shape must work too —
      // this is the branch a live mark did NOT take, which is exactly why it needs a test.
      const [conc] = await attacker.createEmbeddedDocuments('ActiveEffect', [
        dnd5e.documents.ActiveEffect5e.createConcentrationEffectData(
          hmAttacker.system.activities.contents.find(a => a.type === 'utility') ?? activity())
      ]);
      created.effects.push({ actorId: attacker.id, id: conc.id });
      await putMark(conc.uuid);
      rolls = await rollAt();
      ok('7. a concentration-shaped origin works too', forceParts(rolls)[0]?.formula === '1d6',
        JSON.stringify(rolls));
    }

    // ---------------------------------------------------------------- 8. Foe Slayer REPLACES
    if (want(8)) {
      await clearMarks();
      await putMark(itemOrigin);
      const foe = await grant(attacker, 'foe-slayer');
      if (!foe) {
        ok('8. foe-slayer upgrade', false, 'foe-slayer not found in any compendium');
      } else {
        rolls = await rollAt();
        const force = forceParts(rolls);
        // Replaces, never stacks: exactly ONE force part, and it is the d10.
        ok('8. Foe Slayer replaces the die (d10, and only one)',
          (force.length === 1) && (force[0].formula === '1d10'), JSON.stringify(rolls));
      }
    }

    // The shape the table's marks actually had (Session 8, 2026-09-22 — six hits, no die): the
    // 6.0 migration left the PACK's uuid in every world template's `system.origin.item`, and an
    // application copies the template and merges its own provenance over it. §§1-8 never saw it:
    // they plant the 5.x `origin` string on a template fresh from the pack, which has no `item`.
    const packMark = (await findInPacks('hunters-mark'))?.uuid
      ?? 'Compendium.dnd-players-handbook.spells.Item.phbsplHuntersMar';
    // A Foe Slayer the fixture already owned (or §8 granted) replaces the die: expect its d10.
    const expectDie = () => (attacker.items.some(i => i.system?.identifier === 'foe-slayer') ? '1d10' : '1d6');
    const markActivity = [...hmAttacker.system.activities].find(a =>
      (a.type === 'utility') && (a.effects ?? []).some(e => e._id === markerTemplate.id) && !a.activation?.override)
      ?? [...hmAttacker.system.activities].find(a => (a.type === 'utility') && (a.effects ?? []).length);

    // ------------------------------------ 9. the tray's shape: stale item, fresh activity
    if (want(9)) {
      // Exactly what `_prepareEffectData` leaves on the target: the template's stale `item`
      // beside the `activity` the tray writes fresh, and no `origin` string of ours.
      await clearMarks();
      await putMark(null, { system: { origin: { item: packMark, activity: markActivity?.uuid ?? null } } });
      rolls = await rollAt();
      ok("9. a mark carrying the pack's uuid beside a fresh activity still pays",
        (forceParts(rolls).length === 1) && (forceParts(rolls)[0].formula === expectDie()),
        `activity=${markActivity?.uuid ?? 'NONE'} ${JSON.stringify(rolls)}`);
    }

    // ------------------------------------ 10. through the cast: the applier names the caster
    if (want(10)) {
      // The table's path end to end: the cast slice lands the mark from a template staled the
      // way the migration staled Jetten's, and the landed copy must name the CASTER — to this
      // module's reader (the die) and to the platform's own (`getSourceActor`, which every
      // "your next turn" clock is judged against).
      await clearMarks();
      // §7's hand-made concentration would make this cast ask which one to drop.
      const ownConc = created.effects.filter(e => (e.actorId === attacker.id) && attacker.effects.get(e.id));
      if (ownConc.length) await attacker.deleteEmbeddedDocuments('ActiveEffect', ownConc.map(e => e.id));
      if (!markActivity) {
        ok('10. cast lands a mark that names the caster', false, 'no Mark Creature activity on the fixture');
      } else {
        await game.settings.set(MOD, 'castApply', true);
        await game.settings.set(MOD, 'dramaticBeat', 0);
        await game.settings.set(MOD, 'reactionHold', false);
        const slotKey = `system.activities.${markActivity.id}.consumption.spellSlot`;
        itemRestores.push({ item: hmAttacker, data: { [slotKey]: markActivity.consumption?.spellSlot ?? true } });
        itemRestores.push({ item: hmAttacker, effect: markerTemplate.id,
          data: { 'system.origin.item': markerTemplate.system.origin?.item ?? null } });
        await hmAttacker.updateEmbeddedDocuments('ActiveEffect',
          [{ _id: markerTemplate.id, 'system.origin.item': packMark }]);
        // The innate shape (smoke-cast's fixtures): the cast spends no slot the fixture lacks.
        await hmAttacker.update({ [slotKey]: false });
        victimToken.setTarget(true, { releaseOthers: true });
        await sleep(120);
        const before = new Set(game.messages.contents.map(m => m.id));
        const used = await hmAttacker.system.activities.get(markActivity.id).use({}, { configure: false }, {});
        let landed = null;
        for (let i = 0; i < 40 && !landed; i++) {
          landed = victim.effects.find(e => (e._stats?.duplicateSource === markerTemplate.uuid)
            && e.getFlag(MOD, 'applied'));
          if (!landed) await sleep(200);
        }
        created.messages.push(...game.messages.contents.filter(m => !before.has(m.id)).map(m => m.id));
        for (const e of attacker.effects.filter(e => e.statuses?.has?.('concentrating')))
          created.effects.push({ actorId: attacker.id, id: e.id });
        if (landed) created.effects.push({ actorId: victim.id, id: landed.id });
        ok('10a. the cast lands the mark through the applier', !!landed,
          `use=${used === undefined ? 'REFUSED' : 'ok'} landed=${landed?.uuid ?? 'NONE'}`);
        ok("10b. the landed mark names the caster to the platform's own reader",
          landed?.getSourceActor?.() === attacker,
          `system.origin=${JSON.stringify(landed?.system?.origin ?? null)}`);
        rolls = await rollAt();
        ok('10c. and the hit pays the die', (forceParts(rolls).length === 1)
          && (forceParts(rolls)[0].formula === expectDie()), JSON.stringify(rolls));
      }
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}` };
  } finally {
    await teardown();
    // Fixtures spend real resources; the suites put them back (HANDOFF).
    for (const a of [attacker, victim, bystander]) { try { await a.longRest?.({ dialog: false, chat: false }); } catch { /* fine */ } }
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'riders', out, plan, f });
