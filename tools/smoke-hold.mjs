// Battle Flow Phase 1.5 smoke test — drives the reaction hold end to end in the live world,
// using GREN'S OWN SHIELD against a real attack. Asserts the whole shape:
//   hit on a Shield-holder → damage does NOT roll, hold stamped pending
//   → cast answers the hold → live AC re-test → miss → chain ends, no damage, no HP lost
//   → pass answers the hold → damage rolls normally
//   → crit skips the hold entirely (a natural 20 hits regardless of AC)
//   → reaction-spent suppresses the next hold
// Restores every setting it touched, deletes its own chat messages, and leaves Gren's HP,
// AC and spell slots exactly as it found them.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[hold] WATCHDOG 420s'); process.exit(3); }, 420_000);

const f = new Foundry({
  serverUrl: env.MOLTEN_SERVER_URL, magicUrl: env.MOLTEN_MAGIC_URL,
  user: env.FOUNDRY_USER || 'Claude', password: env.FOUNDRY_PASSWORD,
  adminKey: env.MOLTEN_ADMIN_KEY, worldId: env.MOLTEN_WORLD_ID,
});
console.log('[hold] connecting…');
await f.connect();
console.log('[hold] connected');

let failures = 0;
const report = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

// The whole scenario runs in ONE page context so state stays coherent across steps.
const r = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const log = [];
  const results = {};
  let restore = null;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const waitFor = async (fn, ms = 12000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(200); }
    return null;
  };

  try {
    // ---- setup ---------------------------------------------------------------------------
    const gren = game.actors.getName('Gren Greenmantle');
    if (!gren) return { ok: false, why: 'Gren Greenmantle not found' };
    const shield = gren.items.find(i => i.name === 'Shield' && i.type === 'spell');
    if (!shield) return { ok: false, why: 'Gren has no Shield spell' };

    const scene = game.scenes.getName('Battle Flow Test Range');
    const attacker = game.actors.getName('BF Test Attacker');
    if (!scene || !attacker) return { ok: false, why: 'test scene/attacker missing — run smoke-battleflow.mjs first' };

    restore = {
      settings: {
        autoDamage: game.settings.get(MOD, 'autoDamage'),
        autoApply: game.settings.get(MOD, 'autoApply'),
        dramaticBeat: game.settings.get(MOD, 'dramaticBeat'),
        reactionHold: game.settings.get(MOD, 'reactionHold'),
        holdSettle: game.settings.get(MOD, 'holdSettle'),
        holdView: game.settings.get(MOD, 'holdView'),
        holdApplyEffect: game.settings.get(MOD, 'holdApplyEffect'),
        suppressAttackCards: game.settings.get(MOD, 'suppressAttackCards'),
        requireTarget: game.settings.get(MOD, 'requireTarget'),
      },
      grenHP: foundry.utils.deepClone(gren.system._source.attributes.hp),
      grenAC: foundry.utils.deepClone(gren.system._source.attributes.ac),
      grenSlots: foundry.utils.deepClone(gren.system._source.spells),
    };
    await game.settings.set(MOD, 'autoDamage', 'all');
    await game.settings.set(MOD, 'autoApply', true);
    await game.settings.set(MOD, 'dramaticBeat', 0);
    await game.settings.set(MOD, 'reactionHold', true);
    await game.settings.set(MOD, 'holdSettle', 6);
    await game.settings.set(MOD, 'holdApplyEffect', true);
    await game.settings.set(MOD, 'holdView', false); // no popup: the bridge cannot dismiss it
    await game.settings.set(MOD, 'suppressAttackCards', false);
    await game.settings.set(MOD, 'requireTarget', false);

    // ⚠ Gren's AC is left on its NORMAL calculation. Pinning it with calc:"flat" would make
    // the test a lie: a flat AC ignores system.attributes.ac.bonus, which is exactly the
    // field Shield's active effect writes — so the +5 could never appear and every re-test
    // would read a stale-looking AC (bit live 2026-08-15).
    //
    // ⚠ The harness runs as a GM, and the module deliberately refuses to let a GM answer a
    // hold for a character a LOGGED-IN PLAYER owns — the decision belongs to that player.
    // So when Gren's player is connected the GM cannot drive his Shield, and the real-cast
    // path is exercised on a GM-owned stand-in instead (a copy of Gren's actual Shield on
    // the test NPC), which is answerable from here. The flag-write path below still covers
    // Gren himself.
    const grenOwnedByActivePlayer = game.users.some(u =>
      !u.isGM && u.active && gren.testUserPermission(u, 'OWNER'));
    log.push(`gren owned by an active player: ${grenOwnedByActivePlayer}`);
    const baseAC = gren.system.attributes.ac.value;
    let grenToken = scene.tokens.find(t => t.actorId === gren.id);
    if (!grenToken) {
      [grenToken] = await scene.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(
        gren.prototypeToken.toObject(),
        { x: 1300, y: 1000, actorId: gren.id, actorLink: true }, { inplace: false })]);
    }
    if (canvas.scene?.id !== scene.id) await scene.view();
    await waitFor(() => canvas.ready && canvas.tokens.get(grenToken.id));
    const grenTokenObj = canvas.tokens.get(grenToken.id);
    if (!grenTokenObj) return { ok: false, why: 'Gren token never appeared on canvas' };

    const weapon = attacker.items.find(i => i.system.activities?.some?.(a => a.type === 'attack'));
    const activity = () => attacker.items.get(weapon.id).system.activities.find(a => a.type === 'attack');

    // Fire one attack at Gren and return the attack message.
    const attackGren = async (opts = {}) => {
      grenTokenObj.setTarget(true, { releaseOthers: true });
      const usage = await activity().use({ subsequentActions: false }, { configure: false }, {});
      const usageId = usage?.message?.id;
      const rolls = await activity().rollAttack(
        opts, { configure: false }, { data: { 'flags.dnd5e.originatingMessage': usageId } });
      const msg = rolls?.[0]?.parent;
      return { usageId, msg, total: rolls?.[0]?.total, crit: rolls?.[0]?.isCritical,
        fumble: rolls?.[0]?.isFumble };
    };

    // A PLAIN hit — neither a crit nor a fumble. Both are real dice outcomes with correct
    // but different behaviour (a natural 20 deliberately skips an AC-type hold, since no
    // amount of AC saves you from it), so the hold tests must not roll them by accident.
    // `window` additionally demands a total inside [AC, AC+4], the band where Shield's +5
    // actually flips the outcome — otherwise "cast → miss" would be untestable.
    const plainHitOnGren = async ({ window = false } = {}) => {
      const tries = window ? 40 : 12;
      for (let i = 0; i < tries; i++) {
        const a = await attackGren(window ? { advantage: true } : {});
        const hits = a.total >= baseAC;
        const flips = !window || (a.total < baseAC + 5);
        if (!a.crit && !a.fumble && hits && flips) return a;
        log.push(`discarded: total=${a.total} crit=${a.crit} fumble=${a.fumble} (AC ${baseAC})`);
        await sleep(120);
      }
      throw new Error(`could not roll a plain hit${window ? ` in [${baseAC}, ${baseAC + 4}]` : ''} in ${tries} attempts`);
    };
    // ⚠ Search the WHOLE log, not a tail window. An originating id is unique to one attack, so
    // a wider search cannot produce a false positive — but a tail window produces false
    // NEGATIVES: these sections fire up to 60 attacks, and a late-resolving stray hold injects
    // announcement messages that push a real damage card out of a 14-message tail. That flaked
    // two assertions on 2026-08-15 ("damage flows" and the crit skip) and cost a bisect.
    const damageFor = usageId => game.messages.contents.find(m =>
      m.getFlag('dnd5e', 'roll.type') === 'damage'
      && m.getFlag('dnd5e', 'originatingMessage') === usageId);

    // When a damage assertion fails, say WHY rather than just "false": a damage message that
    // exists but has scrolled out of damageFor's 14-message window is a harness artifact; one
    // that does not exist at all is the module. Gren's live AC and HP are here too, because a
    // stray Shield effect makes a "hit" by the harness's captured baseAC a miss to the module.
    const diagnose = (usageId, total) => ({
      existsAnywhere: !!game.messages.contents.find(m =>
        m.getFlag('dnd5e', 'roll.type') === 'damage'
        && m.getFlag('dnd5e', 'originatingMessage') === usageId),
      attackTotal: total ?? null,
      grenLiveAC: gren.system.attributes.ac.value,
      grenBaseAC: baseAC,
      grenHP: gren.system.attributes.hp.value,
      grenEffects: gren.effects.map(e => `${e.name}/disabled=${e.disabled}`),
      messagesSinceUsage: game.messages.contents.length
        - game.messages.contents.findIndex(m => m.id === usageId),
    });

    /**
     * A GM-owned stand-in for Gren: a full clone of him, so the Shield being cast is a real
     * spell on a real spellcaster with real slots.
     *
     * Why not just bolt Shield onto the test NPC — twice tried, twice wrong (2026-08-15):
     * an item added to a base actor reaches an UNLINKED token's delta stripped of its
     * embedded effects and activities, and an NPC's spell1.max is DERIVED from spellcasting
     * progression, so it recomputes to 0 and every cast aborts for want of a slot.
     * Why not Gren himself: the module correctly refuses to let a GM answer a hold for a
     * character a logged-in player owns, and the harness is a GM.
     */
    const ensureShielder = async () => {
      let actor = game.actors.getName('BF Test Shielder');
      if (!actor) {
        const data = gren.toObject();
        delete data._id;
        data.name = 'BF Test Shielder';
        data.ownership = { default: 0 };           // GM-only: no player may answer for it
        data.prototypeToken.actorLink = true;      // linked: no delta to lose items through
        data.prototypeToken.name = 'BF Test Shielder';
        actor = await Actor.create(data);
        log.push('created BF Test Shielder');
      }
      let doc = scene.tokens.find(t => t.actorId === actor.id);
      if (!doc) {
        [doc] = await scene.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(
          actor.prototypeToken.toObject(),
          { x: 1500, y: 1000, actorId: actor.id, actorLink: true }, { inplace: false })]);
      }
      await waitFor(() => canvas.ready && canvas.tokens.get(doc.id));
      // Fresh slots and a clean slate every run.
      await actor.update({ 'system.spells.spell1.value': actor.system.spells.spell1.max || 4 });
      await actor.unsetFlag(MOD, 'reactionSpent');
      for (const e of actor.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
      const token = canvas.tokens.get(doc.id);
      const sh = actor.items.find(i => i.name === 'Shield' && i.type === 'spell');
      if (!sh?.system.activities?.contents?.length) throw new Error('stand-in has no usable Shield');
      if (!actor.system.spells.spell1.max) throw new Error('stand-in has no level 1 spell slots');
      return { actor, token };
    };

    // ---- 1. the hold fires and damage does NOT roll ----------------------------------------
    {
      const { usageId, msg, total } = await plainHitOnGren({ window: true });
      const held = await waitFor(() => {
        const h = game.messages.get(msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'pending' ? h : null;
      });
      await sleep(1500); // give a (wrongly) unheld damage roll time to appear
      results.holdFired = {
        pending: !!held,
        reaction: held?.targets?.[0]?.reaction,
        kind: held?.targets?.[0]?.kind,
        total,
        damageRolled: !!damageFor(usageId),
      };

      // ---- 2. CAST answers it; live AC re-test turns the hit into a miss -------------------
      const hpBefore = gren.system._source.attributes.hp.value;
      const holdDoc = game.messages.get(msg.id);
      const merged = foundry.utils.deepClone(holdDoc.getFlag(MOD, 'hold'));
      merged.targets.find(t => t.uuid === gren.uuid).answer = 'cast';
      // Stand in for the effect the player's own client would apply on their cast.
      const effectData = shield.effects.contents[0].toObject();
      effectData.disabled = false;
      effectData.origin = shield.effects.contents[0].uuid;
      await gren.createEmbeddedDocuments('ActiveEffect', [effectData]);
      await holdDoc.setFlag(MOD, 'hold', merged);
      await sleep(800);
      const afterWrite = game.messages.get(msg.id)?.getFlag(MOD, 'hold');
      results.diag = {
        targets: afterWrite?.targets,
        grenUuid: gren.uuid,
        allAnsweredNow: afterWrite?.targets?.every(t => t.answer),
        statusNow: afterWrite?.status,
      };

      if (!held) throw new Error('hold never went pending — cannot test the cast answer');
      const resolved = await waitFor(() => {
        const h = game.messages.get(msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'resolved' ? h : null;
      }, 25000);
      await sleep(1200);
      results.castResolves = {
        resolved: !!resolved,
        verdict: resolved?.targets?.find(t => t.uuid === gren.uuid)?.verdict,
        liveAC: gren.system.attributes.ac.value,
        attackTotal: total,
        damageRolled: !!damageFor(usageId),
        hpUnchanged: gren.system._source.attributes.hp.value === hpBefore,
      };
      for (const e of gren.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
      await gren.unsetFlag(MOD, 'reactionSpent');
    }

    // ---- 3. PASS lets the attack through: damage rolls -------------------------------------
    {
      const { usageId, msg } = await plainHitOnGren();
      const held = await waitFor(() => {
        const h = game.messages.get(msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'pending' ? h : null;
      });
      if (!held) throw new Error('hold never went pending — cannot test the pass answer');
      const doc = game.messages.get(msg.id);
      const merged = foundry.utils.deepClone(doc.getFlag(MOD, 'hold'));
      merged.targets.find(t => t.uuid === gren.uuid).answer = 'pass';
      await doc.setFlag(MOD, 'hold', merged);
      const dmg = await waitFor(() => damageFor(usageId), 15000);
      results.passProceeds = { held: !!held, damageRolled: !!dmg };
      await gren.unsetFlag(MOD, 'reactionSpent');
    }

    // ---- 4. reaction already spent ⇒ no hold at all -----------------------------------------
    {
      await gren.setFlag(MOD, 'reactionSpent', true);
      const { usageId, msg, total } = await plainHitOnGren();
      await sleep(2500);
      results.spentSuppresses = {
        held: !!game.messages.get(msg.id)?.getFlag(MOD, 'hold'),
        damageRolled: !!damageFor(usageId),
        why: diagnose(usageId, total),
      };
      await gren.unsetFlag(MOD, 'reactionSpent');
    }

    // ---- 4b. THE REAL CAST PATH, on a GM-answerable stand-in --------------------------------
    // A copy of Gren's actual Shield on the test NPC: the GM can answer for it, so the whole
    // production chain runs for real — cast → module applies the effect → AC moves → the
    // hold re-tests against it. This is the path that was silently broken until now, because
    // Shield's +5 lives in an effect nobody had pressed.
    {
      const { actor: victimActor, token: victimTokenObj } = await ensureShielder();
      const vAC = victimActor.system.attributes.ac.value;

      // Attack it into the window where Shield's +5 flips the outcome.
      let atk = null;
      for (let i = 0; i < 40 && !atk; i++) {
        victimTokenObj.setTarget(true, { releaseOthers: true });
        const usage = await activity().use({ subsequentActions: false }, { configure: false }, {});
        const rolls = await activity().rollAttack({ advantage: true }, { configure: false },
          { data: { 'flags.dnd5e.originatingMessage': usage?.message?.id } });
        const t = rolls?.[0];
        if (t && !t.isCritical && !t.isFumble && (t.total >= vAC) && (t.total < vAC + 5)) {
          atk = { usageId: usage?.message?.id, msg: t.parent, total: t.total };
        } else await sleep(100);
      }
      if (!atk) throw new Error(`no attack landed in [${vAC}, ${vAC + 4}] against the stand-in`);

      const pending = await waitFor(() => {
        const h = game.messages.get(atk.msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'pending' ? h : null;
      });

      // Drive the CARD'S OWN Cast button, not a hand-rolled use — that button silently
      // recorded an answer without casting anything until 2026-08-15, and only clicking the
      // real control catches that class of bug. Falls back to a direct use if the row has
      // not rendered in this headless context.
      const slotsBefore = victimActor.system.spells.spell1.value;
      const castButton = Array.from(document.querySelectorAll(
        `[data-message-id="${atk.msg.id}"] .battleflow-hold button`))
        .find(b => b.textContent.trim() === 'Cast');
      if (!castButton) throw new Error('the hold row rendered no Cast button for a GM-owned target');
      castButton.click();

      const done = await waitFor(() => {
        const h = game.messages.get(atk.msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'resolved' ? h : null;
      }, 25000);
      await sleep(1200);
      results.realCast = {
        pending: !!pending,
        answered: done?.targets?.[0]?.answer,
        verdict: done?.targets?.[0]?.verdict,
        acBefore: vAC,
        acAfter: victimActor.system.attributes.ac.value,
        effectApplied: !!victimActor.effects.find(e => e.name === 'Imperceptible Barrier' && !e.disabled),
        attackTotal: atk.total,
        damageRolled: !!damageFor(atk.usageId),
        slotsBefore,
        slotsAfter: victimActor.system.spells.spell1.value,
        usedCardButton: !!castButton,
      };
      for (const e of victimActor.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
      await victimActor.unsetFlag(MOD, 'reactionSpent');
    }

    // ---- 4b2. ONE casting answers MANY holds, and lands exactly ONE effect -------------------
    // A multiattack that lands twice stamps two holds on the same target; RAW the one Shield
    // covers both. The cast used to spawn its work per hold, concurrently, so each application
    // read the actor's effects before any other had written one and each created its own —
    // +10 AC from a single casting. Deterministic here: stamp exactly two holds, cast once.
    {
      const { actor: victimActor, token: victimTokenObj } = await ensureShielder();
      const vAC = victimActor.system.attributes.ac.value;
      const slotsBefore = victimActor.system.spells.spell1.value;

      // Two separate attacks that both HIT (any margin — the verdict is not what is on trial).
      const held = [];
      for (let i = 0; i < 40 && held.length < 2; i++) {
        victimTokenObj.setTarget(true, { releaseOthers: true });
        const usage = await activity().use({ subsequentActions: false }, { configure: false }, {});
        const rolls = await activity().rollAttack({ advantage: true }, { configure: false },
          { data: { 'flags.dnd5e.originatingMessage': usage?.message?.id } });
        const t = rolls?.[0];
        if (!t || t.isCritical || t.isFumble || (t.total < vAC)) { await sleep(100); continue; }
        const msg = t.parent;
        const ok = await waitFor(() =>
          game.messages.get(msg.id)?.getFlag(MOD, 'hold')?.status === 'pending', 6000)
          .catch(() => null);
        if (ok) held.push(msg.id);
      }
      if (held.length < 2) throw new Error(`only ${held.length} hold(s) stamped; need 2`);

      // ONE cast, driven from the first hold's card button.
      const castButton = Array.from(document.querySelectorAll(
        `[data-message-id="${held[0]}"] .battleflow-hold button`))
        .find(b => b.textContent.trim() === 'Cast');
      if (!castButton) throw new Error('no Cast button on the first of the two holds');
      castButton.click();

      await waitFor(() => game.messages.get(held[0])?.getFlag(MOD, 'hold')?.status === 'resolved',
        25000);
      await sleep(1500);
      const barriers = victimActor.effects.filter(e =>
        e.name === 'Imperceptible Barrier' && !e.disabled);
      results.oneCastOneEffect = {
        holds: held.length,
        effectCount: barriers.length,
        acBefore: vAC,
        acAfter: victimActor.system.attributes.ac.value,
        slotsSpent: slotsBefore - victimActor.system.spells.spell1.value,
        // The second hold must also read as answered by that single cast, not left pending.
        secondAnswered: game.messages.get(held[1])?.getFlag(MOD, 'hold')?.targets?.[0]?.answer ?? null,
      };
      for (const e of victimActor.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
      await victimActor.unsetFlag(MOD, 'reactionSpent');
    }

    // ---- 4c. THE SAFETY NET: a cast whose client never applied the effect --------------------
    // Reproduces the live failure of 2026-08-15 exactly — Tom cast Shield, nothing applied
    // his effect, and the module announced "Shield raises AC to 12" and dealt damage. Here
    // the answer is written WITHOUT any effect, so only the continuing client's safety net
    // can save it: it must land the effect itself and reach a miss.
    {
      const { actor: victimActor, token: victimTokenObj } = await ensureShielder();
      const vAC = victimActor.system.attributes.ac.value;

      let atk = null;
      for (let i = 0; i < 40 && !atk; i++) {
        victimTokenObj.setTarget(true, { releaseOthers: true });
        const usage = await activity().use({ subsequentActions: false }, { configure: false }, {});
        const rolls = await activity().rollAttack({ advantage: true }, { configure: false },
          { data: { 'flags.dnd5e.originatingMessage': usage?.message?.id } });
        const t = rolls?.[0];
        if (t && !t.isCritical && !t.isFumble && (t.total >= vAC) && (t.total < vAC + 5)) {
          atk = { usageId: usage?.message?.id, msg: t.parent, total: t.total };
        } else await sleep(100);
      }
      if (!atk) throw new Error(`no attack landed in [${vAC}, ${vAC + 4}] for the safety-net test`);
      await waitFor(() => game.messages.get(atk.msg.id)?.getFlag(MOD, 'hold')?.status === 'pending');

      // Answer "cast" with NO effect applied and no real use — the stale-client scenario.
      const doc = game.messages.get(atk.msg.id);
      const m = foundry.utils.deepClone(doc.getFlag(MOD, 'hold'));
      m.targets[0].answer = 'cast';
      await doc.setFlag(MOD, 'hold', m);

      const done = await waitFor(() => {
        const h = game.messages.get(atk.msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'resolved' ? h : null;
      }, 25000);
      await sleep(1200);
      results.safetyNet = {
        verdict: done?.targets?.[0]?.verdict,
        acBefore: vAC,
        acAtVerdict: done?.targets?.[0]?.acAtVerdict,
        effectLanded: !!victimActor.effects.find(e => e.name === 'Imperceptible Barrier' && !e.disabled),
        damageRolled: !!damageFor(atk.usageId),
      };
      for (const e of victimActor.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
      await victimActor.unsetFlag(MOD, 'reactionSpent');
    }

    // ---- 4d. A NAME MATCH IS NOT A REACTION --------------------------------------------------
    // A hobgoblin WEARS a shield: an `equipment` item literally named "Shield". It matched the
    // interrupt list on name alone, so every shield-carrying monster in the world held the
    // chain for a spell it cannot cast — "Hobgoblin — Shield?" on a creature with no spells at
    // all (reported live 2026-08-15). Eleven such items existed in the world at the time.
    {
      const victimBase = game.actors.getName('BF Test Victim');
      const vTokDoc = victimBase ? scene.tokens.find(t => t.actorId === victimBase.id) : null;
      if (!vTokDoc) throw new Error('BF Test Victim has no token — run smoke-battleflow.mjs first');
      const vActor = vTokDoc.actor;   // unlinked: the thing attacked is the synthetic actor

      // Idempotent fixture: the mundane shield must actually be present for this to prove
      // anything. Built on the TOKEN actor — an item added to the base reaches an unlinked
      // token's delta stripped of its embedded pieces.
      let mundane = vActor.items.find(i => i.name === 'Shield' && i.type !== 'spell');
      if (!mundane) {
        [mundane] = await vActor.createEmbeddedDocuments('Item',
          [{ name: 'Shield', type: 'equipment', system: { type: { value: 'shield' } } }]);
      }
      await victimBase.update({
        'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1 });

      canvas.tokens.get(vTokDoc.id).setTarget(true, { releaseOthers: true });
      const usage = await activity().use({ subsequentActions: false }, { configure: false }, {});
      const usageId = usage?.message?.id;
      const rolls = await activity().rollAttack({ advantage: true }, { configure: false },
        { data: { 'flags.dnd5e.originatingMessage': usageId } });
      await sleep(2500);
      results.mundaneShield = {
        itemType: mundane.type,
        itemActivation: mundane.system?.activation?.type ?? null,
        // If a real Shield SPELL is also on the fixture the test proves nothing — say so.
        strayShieldSpell: vActor.items.some(i => (i.name === 'Shield') && (i.type === 'spell')),
        held: !!game.messages.get(rolls?.[0]?.parent?.id)?.getFlag(MOD, 'hold'),
        damageRolled: !!damageFor(usageId),
        attackTotal: rolls?.[0]?.total,
      };
    }

    // ---- 5. a natural 20 skips an AC-type hold (no AC saves you from a crit) ----------------
    {
      let crit = null;
      for (let i = 0; i < 60 && !crit; i++) {
        const a = await attackGren({ advantage: true });
        if (a.crit) crit = a; else await sleep(80);
      }
      if (crit) {
        await sleep(2000);
        results.critSkipsHold = {
          rolled: true,
          held: !!game.messages.get(crit.msg.id)?.getFlag(MOD, 'hold'),
          damageRolled: !!damageFor(crit.usageId),
          why: diagnose(crit.usageId, crit.total),
        };
      } else {
        results.critSkipsHold = { rolled: false }; // no crit in 60 tries; reported, not failed
      }
      await gren.unsetFlag(MOD, 'reactionSpent');
    }

    return { ok: true, results, log };
  } catch (err) {
    return { ok: false, why: `${err.message}\n${err.stack}`, results, log };
  } finally {
    // ---- always: put the world back exactly as we found it ---------------------------------
    try {
      const gren = game.actors.getName('Gren Greenmantle');
      if (restore) {
        for (const [k, v] of Object.entries(restore.settings)) await game.settings.set(MOD, k, v);
        await gren?.update({
          'system.attributes.hp.value': restore.grenHP.value,
          'system.attributes.hp.temp': restore.grenHP.temp,
          'system.spells': restore.grenSlots,
        });
        await gren?.unsetFlag(MOD, 'reactionSpent');
        for (const e of gren?.effects?.filter(e => e.name === 'Imperceptible Barrier') ?? []) await e.delete();
      }
      // Long rest every fixture: these suites spend real spell slots and beat real HP off the
      // stand-ins, and nothing else puts it back. Without this the suite quietly runs itself
      // out of Shield and starts failing for want of a slot instead of for a bug, and leaves
      // 0-HP corpses lying in the world between runs. Fixtures only — never the live PCs.
      for (const name of ['BF Test Shielder', 'BF Test Attacker', 'BF Test Victim', 'BF Test PC Attacker']) {
        const fixture = game.actors.getName(name);
        if (!fixture) continue;
        try {
          await fixture.longRest({ dialog: false, chat: false, newDay: true });
        } catch (restErr) {
          // longRest's signature is the system's, not ours — fall back to the manual restore
          // so a system change degrades to "resources back" rather than "suite broken".
          const spells = {};
          for (const [key, slot] of Object.entries(fixture.system.spells ?? {})) {
            if (slot?.max) spells[`system.spells.${key}.value`] = slot.max;
          }
          await fixture.update({
            ...spells,
            'system.attributes.hp.value': fixture.system.attributes.hp.max,
            'system.attributes.hp.temp': 0,
          });
        }
        await fixture.unsetFlag(MOD, 'reactionSpent');
        for (const e of fixture.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
      }
      const mine = game.messages.filter(m =>
        m.speaker?.alias?.startsWith('BF Test') || m.speaker?.alias === 'Battle Flow'
        || (m.speaker?.alias === 'Gren Greenmantle' && m.getFlag(MOD, 'respondsTo')));
      await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (cleanupErr) {
      console.error('cleanup failed', cleanupErr);
    }
  }
}, null);

if (!r.ok) {
  console.error(`[hold] SETUP/RUN FAILED — ${r.why}`);
  process.exit(1);
}
const x = r.results;
report('hit on a Shield holder stamps a pending hold',
  x.holdFired?.pending && x.holdFired?.reaction === 'Shield' && x.holdFired?.kind === 'ac',
  JSON.stringify(x.holdFired));
report('held attack does NOT roll damage', x.holdFired?.damageRolled === false,
  `damage rolled: ${x.holdFired?.damageRolled}`);
report('cast → live-AC re-test turns the hit into a miss',
  x.castResolves?.resolved && x.castResolves?.verdict === 'miss',
  JSON.stringify(x.castResolves));
report('a missed attack never rolls damage and costs no HP',
  x.castResolves?.damageRolled === false && x.castResolves?.hpUnchanged === true,
  `damage: ${x.castResolves?.damageRolled}, hp unchanged: ${x.castResolves?.hpUnchanged}`);
report('pass → the chain proceeds and damage rolls',
  x.passProceeds?.held && x.passProceeds?.damageRolled, JSON.stringify(x.passProceeds));
report('reaction already spent ⇒ no hold, damage flows',
  x.spentSuppresses?.held === false && x.spentSuppresses?.damageRolled === true,
  JSON.stringify(x.spentSuppresses));
report('REAL cast: the reaction answers its own hold', x.realCast?.pending && x.realCast?.answered === 'cast',
  `pending=${x.realCast?.pending}, answer=${x.realCast?.answered}, via card button=${x.realCast?.usedCardButton}`);
report('REAL cast: the Cast control actually spends the slot (it is a cast, not a vote)',
  x.realCast?.slotsAfter === x.realCast?.slotsBefore - 1,
  `slots ${x.realCast?.slotsBefore} → ${x.realCast?.slotsAfter}`);
report("REAL cast: the module lands the reaction's effect and AC moves +5",
  x.realCast?.effectApplied === true && x.realCast?.acAfter === x.realCast?.acBefore + 5,
  `AC ${x.realCast?.acBefore} → ${x.realCast?.acAfter}, effect applied: ${x.realCast?.effectApplied}`);
report('a mundane shield (equipment, not a spell) never holds the chain',
  x.mundaneShield?.held === false && x.mundaneShield?.damageRolled === true
  && x.mundaneShield?.strayShieldSpell === false,
  JSON.stringify(x.mundaneShield));
report('ONE casting answers MANY holds and lands exactly ONE effect',
  x.oneCastOneEffect?.effectCount === 1
  && x.oneCastOneEffect?.acAfter === x.oneCastOneEffect?.acBefore + 5
  && x.oneCastOneEffect?.slotsSpent === 1,
  JSON.stringify(x.oneCastOneEffect));
report('the second hold is answered by that same casting',
  x.oneCastOneEffect?.secondAnswered === 'cast',
  `second hold answer: ${x.oneCastOneEffect?.secondAnswered}`);
report('REAL cast: the attack becomes a miss and no damage rolls',
  x.realCast?.verdict === 'miss' && x.realCast?.damageRolled === false,
  JSON.stringify(x.realCast));
report('SAFETY NET: a cast whose client applied nothing still reaches a miss',
  x.safetyNet?.verdict === 'miss' && x.safetyNet?.effectLanded === true
    && x.safetyNet?.damageRolled === false,
  JSON.stringify(x.safetyNet));
if (x.critSkipsHold?.rolled) {
  report('a natural 20 skips the AC-type hold',
    x.critSkipsHold.held === false && x.critSkipsHold.damageRolled === true,
    JSON.stringify(x.critSkipsHold));
} else {
  console.log('  SKIP no natural 20 in 60 attempts — crit path not exercised this run');
}
if (r.log?.length) console.log(`\n[hold] discarded rolls: ${r.log.length}`);
if (failures && x.diag) console.log(`\n[hold] diagnostics:\n${JSON.stringify(x.diag, null, 2)}`);

console.log(failures ? `\n[hold] ${failures} FAILURE(S)` : '\n[hold] ALL PASS');
await f.disconnect?.();
process.exit(failures ? 1 : 0);
