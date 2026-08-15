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
// Raised from 420s when the statblock cast-activity sections landed: each of the three hunts
// for an attack inside a 5-wide AC window, and a suite that dies at the watchdog reports
// nothing at all — the one failure mode with no diagnostic value.
setTimeout(() => { console.error('[hold] WATCHDOG 600s'); process.exit(3); }, 600_000);

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

  // Declared out here so the cleanup in `finally` can sweep the statblock fixture even when a
  // section throws before its own teardown — see the sweep for why that matters.
  const CAST_FEATURE = 'BF Test Spellcasting';
  const SHIELD_UUID = 'Compendium.dnd-players-handbook.spells.Item.phbsplShield0000';

  /**
   * Take the statblock fixture back off BF Test Victim.
   *
   * ⚠ ONE batch delete, never a loop of `item.delete()`. A synthetic (unlinked-token) actor
   * rebuilds its item collection from the delta on every write, so the second call in a loop is
   * made against a document the server has already dropped: "Item … does not exist".
   *
   * ⚠ Spell-type items go too, not just what this fixture created. The victim is a hobgoblin
   * that WEARS a shield and section 4d asserts it owns no Shield SPELL — one cached copy left
   * behind by a crashed run fails that assertion for a reason that has nothing to do with the
   * module. One was found squatting there on 2026-08-15.
   */
  const sweepCastFixture = async actor => {
    const doomed = (actor?.items ?? []).filter(i =>
      (i.name === CAST_FEATURE) || i.getFlag('dnd5e', 'cachedFor') || (i.type === 'spell'))
      .map(i => i.id);
    if (doomed.length) await actor.deleteEmbeddedDocuments('Item', doomed);
    return doomed.length;
  };

  /** Shield's effect off an actor — batched, for the same synthetic-actor reason as above. */
  const clearBarriers = async actor => {
    const ids = (actor?.effects ?? []).filter(e => e.name === 'Imperceptible Barrier').map(e => e.id);
    if (ids.length) await actor.deleteEmbeddedDocuments('ActiveEffect', ids);
  };

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
        holdReveal: game.settings.get(MOD, 'holdReveal'),
        holdTimer: game.settings.get(MOD, 'holdTimer'),
        holdSkipFutile: game.settings.get(MOD, 'holdSkipFutile'),
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
    await game.settings.set(MOD, 'holdReveal', true);
    // ⚠ OFF for the classic sections, which assume every hit holds. With it on, any attack
    // landing 5+ over Gren's AC is correctly skipped as hopeless and those sections fail with
    // "hold never went pending" — the feature working, not breaking. Section 4f owns it.
    await game.settings.set(MOD, 'holdSkipFutile', false);
    await game.settings.set(MOD, 'holdTimer', 0);
    await game.settings.set(MOD, 'suppressAttackCards', false);
    await game.settings.set(MOD, 'requireTarget', false);

    // Start from a clean fixture rather than trusting the last run's teardown. A crashed run —
    // or a hand experiment at the console — can leave a cast feature or a cached Shield on BF
    // Test Victim, and section 4d then fails ("a mundane shield never holds") for a reason that
    // has nothing to do with the module: the victim really does know Shield. Cost a red suite
    // on 2026-08-15.
    {
      const victimBase = game.actors.getName('BF Test Victim');
      const victimTok = victimBase ? scene.tokens.find(t => t.actorId === victimBase.id) : null;
      if (victimTok?.actor) {
        const swept = await sweepCastFixture(victimTok.actor);
        if (swept) log.push(`swept ${swept} leftover fixture item(s) off BF Test Victim`);
      }
    }

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

    /**
     * A 2024-statblock caster, built the way the Monster Manual actually ships one and modelled
     * field-for-field on the live Skeletal Mage's "Shield - Spellcasting" (read out of the world
     * 2026-08-15): a FEATURE carrying one `cast` ACTIVITY per spell, with the activation, the
     * resource and the consumption all living on THAT activity. The Shield item on such an actor
     * is not the monster's copy of the spell — it is the system's cached clone, and it reports
     * spellSlot:true with no uses and no slots, which is exactly why interrogating IT concluded
     * every statblock caster was unable to cast and no monster ever held (fixed in v1.1.12).
     *
     * ⚠ Built on the TOKEN actor. An item added to the base reaches an unlinked token's delta
     * stripped of its embedded activities — which is the entire substance of this fixture.
     *
     * ⚠ DO NOT create the cached spell by hand. The system materializes it ITSELF, roughly half
     * a second after the cast activity is created, and a manual `getCachedSpellData()` create
     * races that and leaves the actor with TWO items called Shield (measured 2026-08-15).
     * Wait for it instead. It matters that it lands at all: it is the item the module's effect
     * fallback and `hasReactionEffect` look up by name, and the copy `CastActivity#use` would
     * otherwise create mid-cast.
     *
     * ⚠ And do NOT force `activation: { override: true }` to skip the wait. The activation type
     * is carried in the activity's own source — the live Skeletal Mage stores `override: false`
     * with type `reaction` — so it reads `reaction` from the moment of creation. An override
     * would test a shape no statblock has.
     *
     * `atWill` is the Green Hag shape: `uses.max: ""` and NO consumption target. On a cast
     * activity that means AT-WILL — the exact inverse of the spell-item rule, where an empty
     * pool means there is nothing left to spend.
     */
    const ensureCastStatblock = async ({ atWill = false } = {}) => {
      const base = game.actors.getName('BF Test Victim');
      const tokDoc = base ? scene.tokens.find(t => t.actorId === base.id) : null;
      if (!tokDoc) throw new Error('BF Test Victim has no token — run smoke-battleflow.mjs first');
      const actor = tokDoc.actor;      // unlinked: the thing attacked is the synthetic actor

      // Rebuild from scratch every time: the two variants differ only in fields a merge would
      // quietly keep (an empty `uses.max` does not overwrite a "1").
      //
      // ⚠ ONE batch delete, never a loop of `item.delete()`. A synthetic actor rebuilds its
      // item collection from the delta on every write, so the second call in a loop is made
      // against a document the server has already dropped and throws "Item … does not exist"
      // (bit here 2026-08-15).
      await sweepCastFixture(actor);

      const [feature] = await actor.createEmbeddedDocuments('Item',
        [{ name: CAST_FEATURE, type: 'feat' }]);
      await feature.createActivity('cast', {
        name: 'Shield - Spellcasting',
        spell: { uuid: SHIELD_UUID, level: 1, properties: ['vocal', 'somatic'], spellbook: true },
        activation: { type: 'reaction', override: false },  // exactly as the statblock stores it
        consumption: atWill
          ? { spellSlot: false, targets: [] }
          : { spellSlot: false, targets: [{ type: 'activityUses', value: '1' }] },
        uses: atWill
          ? { spent: 0, max: '', recovery: [] }
          : { spent: 0, max: '1', recovery: [{ period: 'day', type: 'recoverAll' }] },
      }, { renderSheet: false });

      const castOf = () => actor.items.get(feature.id)?.system.activities?.contents
        .find(a => a.type === 'cast');
      if (!castOf()) throw new Error('the cast activity did not survive creation on the token actor');
      const cast = await waitFor(() => castOf()?.cachedSpell ? castOf() : null, 8000);
      if (!cast) throw new Error('the system never materialized the cast activity\'s cached spell');

      // ⚠ A NORMAL AC calculation, never `flat`. dnd5e's prepareArmorClass RETURNS on the flat
      // branch before ac.bonus is ever added — and ac.bonus is the one field Shield's effect
      // writes — so a flat AC would make "the +5 arrived" permanently untestable while looking
      // like a module bug. `natural` is what an NPC ships with and does add the bonus.
      await base.update({
        'system.attributes.ac.calc': 'natural', 'system.attributes.ac.flat': 13 });
      await actor.unsetFlag(MOD, 'reactionSpent');
      await clearBarriers(actor);

      if (cast.activation?.type !== 'reaction') throw new Error(
        `the cast activity reads activation "${cast.activation?.type}" — the cached spell did not land`);
      return { actor, token: canvas.tokens.get(tokDoc.id), feature, castId: cast.id, base };
    };

    // Fire attacks until one lands in [ac, ac+4] — the band where Shield's +5 flips the outcome
    // — skipping crits and fumbles, which are correct-but-different paths. `getActivity` is the
    // ATTACKER's attack activity, so one window serves an NPC attacker and a PC one alike.
    const attackIntoFlipWindow = async (getActivity, tokenObj, ac, tries = 40) => {
      for (let i = 0; i < tries; i++) {
        tokenObj.setTarget(true, { releaseOthers: true });
        const usage = await getActivity().use({ subsequentActions: false }, { configure: false }, {});
        const rolls = await getActivity().rollAttack({ advantage: true }, { configure: false },
          { data: { 'flags.dnd5e.originatingMessage': usage?.message?.id } });
        const t = rolls?.[0];
        if (t && !t.isCritical && !t.isFumble && (t.total >= ac) && (t.total < ac + 5)) {
          return { usageId: usage?.message?.id, msg: t.parent, total: t.total };
        }
        await sleep(100);
      }
      return null;
    };

    // The card's OWN Cast control. Driving this rather than a hand-rolled `use` is the point:
    // it is the control that shipped once as a button that answered without casting, and it is
    // the only path that exercises the itemId/activityId the hold recorded.
    const castButtonFor = messageId => Array.from(document.querySelectorAll(
      `[data-message-id="${messageId}"] .battleflow-hold button`))
      .find(b => b.textContent.trim() === 'Cast');

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

    // ---- 4d2. THE MONSTER PATTERN: a spell paid for by x/x uses, with no slots ---------------
    // A statblock caster carries Shield under "Additional Spells" as an x/x pool, not as a
    // slot — NPC slot maxima derive from a caster level most statblocks never set, so they sit
    // at 0/0. Eligibility used to demand a slot AND `prepared`, and every levelled spell on a
    // 2024 NPC reads prepared: 0, so the entire monster side of this feature was dead.
    {
      const victimBase = game.actors.getName('BF Test Victim');
      const vTokDoc = scene.tokens.find(t => t.actorId === victimBase.id);
      const vActor = vTokDoc.actor;    // unlinked: build on the TOKEN actor or lose the pieces
      const grenShield = gren.items.find(i => i.name === 'Shield' && i.type === 'spell');

      // Give it Shield exactly as a statblock would: one use, no slots anywhere.
      const data = grenShield.toObject();
      delete data._id;
      data.system.uses = { max: '1', spent: 0, recovery: [] };
      data.system.prepared = 0;        // as a 2024 NPC statblock actually stores it
      const [npcShield] = await vActor.createEmbeddedDocuments('Item', [data]);
      await victimBase.update({
        'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 10 });
      await vActor.unsetFlag(MOD, 'reactionSpent');

      const slots = Object.entries(vActor.system.spells ?? {})
        .filter(([k]) => /^spell[1-9]$/.test(k))
        .map(([k, v]) => `${k}:${v?.value ?? 0}/${v?.max ?? 0}`);

      let atk = null;
      for (let i = 0; i < 30 && !atk; i++) {
        canvas.tokens.get(vTokDoc.id).setTarget(true, { releaseOthers: true });
        const usage = await activity().use({ subsequentActions: false }, { configure: false }, {});
        const rolls = await activity().rollAttack({ advantage: true }, { configure: false },
          { data: { 'flags.dnd5e.originatingMessage': usage?.message?.id } });
        const t = rolls?.[0];
        if (t && !t.isCritical && !t.isFumble && t.total >= 10 && t.total < 15) atk = { msg: t.parent, total: t.total };
        else await sleep(70);
      }
      if (!atk) throw new Error('no attack in the NPC flip window');
      const held = await waitFor(() => {
        const h = game.messages.get(atk.msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'pending' ? h : null;
      }, 8000).catch(() => null);

      results.npcUsesSpell = {
        slots: slots.join(' '), itemUses: `${npcShield.system.uses?.value}/${npcShield.system.uses?.max}`,
        prepared: npcShield.system.prepared,
        held: !!held, reaction: held?.targets?.[0]?.reaction ?? null,
      };

      // Answer it so nothing is left pending, then take the spell back off the fixture.
      if (held) {
        const doc = game.messages.get(atk.msg.id);
        const m = foundry.utils.deepClone(doc.getFlag(MOD, 'hold'));
        m.targets.forEach(t => { t.answer = t.answer ?? 'pass'; });
        await doc.setFlag(MOD, 'hold', m);
        await sleep(800);
      }
      await npcShield.delete();
      await vActor.unsetFlag(MOD, 'reactionSpent');
    }

    // ---- 4d3. THE STATBLOCK CAST-ACTIVITY PATH, END TO END -----------------------------------
    // The Skeletal Mage's actual shape, and the most load-bearing path in the feature: a
    // monster casts Shield from a FEATURE's `cast` activity, not from the spell item. Four
    // separate bugs have hidden in this area and until now nothing guarded it — v1.1.12 made it
    // work and was verified only by hand. Everything here is one chain: hold → the recorded
    // ids → the real Cast control → the activity's own use spent → the linked spell's effect →
    // the verdict.
    {
      const { actor: npc, token: npcToken, feature, castId } = await ensureCastStatblock();
      const vAC = npc.system.attributes.ac.value;
      const slotsBefore = JSON.stringify(npc.system.spells ?? {});
      // ⚠ Capture the NUMBER, not the activity. A synthetic actor re-instantiates its items —
      // and with them every activity object — on each data prep, so a reference held across an
      // await either goes stale or is the very object the cast mutates. Either way the
      // before/after comparison is against itself and can never fail.
      const spentBefore = npc.items.get(feature.id).system.activities.get(castId).uses?.spent ?? 0;

      const atk = await attackIntoFlipWindow(activity, npcToken, vAC);
      if (!atk) throw new Error(`no attack landed in [${vAC}, ${vAC + 4}] against the statblock caster`);

      const pending = await waitFor(() => {
        const h = game.messages.get(atk.msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'pending' ? h : null;
      });
      const heldTarget = pending?.targets?.[0] ?? null;

      const button = pending ? castButtonFor(atk.msg.id) : null;
      if (pending && !button) throw new Error('the hold row rendered no Cast button for the statblock caster');
      button?.click();

      const done = pending ? await waitFor(() => {
        const h = game.messages.get(atk.msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'resolved' ? h : null;
      }, 25000) : null;
      await sleep(1200);
      const after = npc.items.get(feature.id)?.system.activities.get(castId)?.uses;
      const spentAfter = after?.spent ?? null;

      // ⚠ What the TABLE is told, which is computed separately from what happens. The verdict
      // comes from the live AC; the wording comes from whether the module can still SEE the
      // reaction's effect (hasReactionEffect → reactionACArrived), and that lookup is by NAME
      // on an actor which — being an armoured caster — owns two items called Shield. So a hold
      // can resolve perfectly and still publish "Reaction — not applied … this resolves as a
      // hit". That combination is the shape of the bug Tom reported, and nothing else in this
      // section would notice it.
      const announcement = game.messages.contents.slice().reverse().find(m =>
        (m.speaker?.alias === 'Battle Flow')
        && m.content.includes(heldTarget?.name ?? ' '));
      const announced = !announcement ? 'none'
        : announcement.content.includes('not applied') ? 'not-applied'
          : announcement.content.includes('it worked') ? 'worked'
            : announcement.content.includes('not enough') ? 'not-enough' : 'other';

      results.statblockCast = {
        announced,
        pending: !!pending,
        reaction: heldTarget?.reaction ?? null,
        // ⚠ The ids, not the name. A name lookup at Cast time finds the mundane shield this
        // fixture also wears, or the cached spell that cannot pay for itself — recording the
        // feature and its cast activity is what made the monster side work at all.
        itemIdOK: heldTarget?.itemId === feature.id,
        activityIdOK: heldTarget?.activityId === castId,
        recorded: `${heldTarget?.itemId ?? null}/${heldTarget?.activityId ?? null}`,
        expected: `${feature.id}/${castId}`,
        answered: done?.targets?.[0]?.answer ?? null,
        verdict: done?.targets?.[0]?.verdict ?? null,
        acBefore: vAC,
        acAfter: npc.system.attributes.ac.value,
        effectApplied: !!npc.effects.find(e => e.name === 'Imperceptible Barrier' && !e.disabled),
        // The activity's own x/x pool pays, and no slot moves — a statblock caster has none to
        // move, so a chain that "worked" by spending a slot would be working by accident.
        usesSpent: (spentAfter === null) ? null : spentAfter - spentBefore,
        usesLabel: `spent ${spentBefore} → ${spentAfter} of ${after?.max ?? '?'}`,
        slotsUnchanged: JSON.stringify(npc.system.spells ?? {}) === slotsBefore,
        damageRolled: !!damageFor(atk.usageId),
        attackTotal: atk.total,
      };
      await clearBarriers(npc);
      await npc.unsetFlag(MOD, 'reactionSpent');
    }

    // ---- 4d4. THE AT-WILL VARIANT: no pool at all still holds ---------------------------------
    // Inverted from the spell-item rule and easy to break: on a cast activity an empty `uses`
    // means the monster can do it all day, not that it is out of charges. The Green Hag carries
    // two spells exactly like this.
    {
      const { actor: npc, token: npcToken, feature, castId } = await ensureCastStatblock({ atWill: true });
      const vAC = npc.system.attributes.ac.value;
      const pool = npc.items.get(feature.id).system.activities.get(castId);
      const poolShape = { max: `${pool?.uses?.max ?? '?'}`,
        targets: (pool?.consumption?.targets ?? []).length };

      const atk = await attackIntoFlipWindow(activity, npcToken, vAC);
      if (!atk) throw new Error(`no attack landed in [${vAC}, ${vAC + 4}] against the at-will caster`);
      const held = await waitFor(() => {
        const h = game.messages.get(atk.msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'pending' ? h : null;
      }, 8000);

      results.atWillCast = {
        usesMax: poolShape.max,
        consumptionTargets: poolShape.targets,
        held: !!held,
        reaction: held?.targets?.[0]?.reaction ?? null,
      };

      // Answer it so nothing is left pending to pop at whoever is logged in.
      if (held) {
        const doc = game.messages.get(atk.msg.id);
        const m = foundry.utils.deepClone(doc.getFlag(MOD, 'hold'));
        m.targets.forEach(t => { t.answer = t.answer ?? 'pass'; });
        await doc.setFlag(MOD, 'hold', m);
        await sleep(800);
      }
      await npc.unsetFlag(MOD, 'reactionSpent');
    }

    // ---- 4d5. A PC ATTACKS A MONSTER THAT HOLDS A REACTION ------------------------------------
    // The mode gate has coverage and the hold has coverage, but the two had never met: every
    // hold above is NPC → PC or NPC → NPC. Here a character-type attacker drives the chain and
    // the monster side answers, against the statblock caster from 4d3.
    //
    // ⚠ What this canNOT cover, and nothing driven from the bridge can: BEING a player's
    // client. The harness is a GM, so the GM rolls the attack and therefore the GM continues
    // the hold — and continueHold's effect safety net is `actor.isOwner`-gated, which is
    // trivially true for a GM and no-ops for a real player against a monster it does not own.
    // That seam (HANDOFF open item 6) stays untested until someone dogfoods it from a player's
    // browser. What IS covered here: the mode gate, the stamp, the answer and the verdict on an
    // attack whose attacker is a character.
    {
      const pcAttacker = game.actors.getName('BF Test PC Attacker');
      if (!pcAttacker) throw new Error('BF Test PC Attacker missing — run smoke-battleflow.mjs first');
      const pcWeapon = pcAttacker.items.find(i => i.system.activities?.some?.(a => a.type === 'attack'));
      if (!pcWeapon) throw new Error('BF Test PC Attacker has no attack activity');
      const pcActivity = () => game.actors.getName('BF Test PC Attacker')
        .items.get(pcWeapon.id).system.activities.find(a => a.type === 'attack');

      const { actor: npc, token: npcToken, feature, castId } = await ensureCastStatblock();
      const vAC = npc.system.attributes.ac.value;

      // (a) With auto-damage limited to NPC attackers, a PC's attack must not hold AT ALL. The
      // hold is a pause in a chain this module is going to continue; stamping one on a chain it
      // has already declined to touch would strand the attack behind a prompt with nothing
      // waiting on the other side. The gate runs before the stamp — assert that it still does.
      await game.settings.set(MOD, 'autoDamage', 'npc');
      npcToken.setTarget(true, { releaseOthers: true });
      const offUsage = await pcActivity().use({ subsequentActions: false }, { configure: false }, {});
      const offUsageId = offUsage?.message?.id;
      // ⚠ Never let this reach damageFor as undefined. getFlag returns undefined for a message
      // that has no originatingMessage at all, so `=== undefined` matches the first unrelated
      // damage card in the log and the gate reads as broken when it is fine.
      if (!offUsageId) throw new Error('the PC attack produced no usage message to trace');
      const offRolls = await pcActivity().rollAttack({ advantage: true }, { configure: false },
        { data: { 'flags.dnd5e.originatingMessage': offUsageId } });
      await sleep(2500);
      const offHeld = !!game.messages.get(offRolls?.[0]?.parent?.id)?.getFlag(MOD, 'hold');

      // (b) With everyone auto-resolving, the same attack holds and answers for real.
      await game.settings.set(MOD, 'autoDamage', 'all');
      await npc.unsetFlag(MOD, 'reactionSpent');
      const atk = await attackIntoFlipWindow(pcActivity, npcToken, vAC);
      if (!atk) throw new Error(`no PC attack landed in [${vAC}, ${vAC + 4}] against the statblock caster`);
      const pending = await waitFor(() => {
        const h = game.messages.get(atk.msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'pending' ? h : null;
      });
      const button = pending ? castButtonFor(atk.msg.id) : null;
      if (pending && !button) throw new Error('the hold row rendered no Cast button on the PC attack');
      button?.click();
      const done = pending ? await waitFor(() => {
        const h = game.messages.get(atk.msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'resolved' ? h : null;
      }, 25000) : null;
      await sleep(1200);

      results.pcVsMonster = {
        attackerType: pcAttacker.type,
        modeNpcHeld: offHeld,                  // must be false: the gate precedes the stamp
        modeNpcDamage: !!damageFor(offUsageId),  // and nothing auto-resolved either
        held: !!pending,
        reaction: pending?.targets?.[0]?.reaction ?? null,
        answered: done?.targets?.[0]?.answer ?? null,
        verdict: done?.targets?.[0]?.verdict ?? null,
        acBefore: vAC,
        acAfter: npc.system.attributes.ac.value,
        effectApplied: !!npc.effects.find(e => e.name === 'Imperceptible Barrier' && !e.disabled),
        damageRolled: !!damageFor(atk.usageId),
        attackTotal: atk.total,
      };
      await clearBarriers(npc);
      await npc.unsetFlag(MOD, 'reactionSpent');
      await sweepCastFixture(npc);
    }

    // ---- 4e. THE TIMER: an unanswered hold passes itself ------------------------------------
    {
      await game.settings.set(MOD, 'holdTimer', 4);
      const { usageId, msg } = await plainHitOnGren({ window: true });
      const pending = await waitFor(() => {
        const h = game.messages.get(msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'pending' ? h : null;
      });
      // Deliberately answer NOTHING. The continuing client's buzzer must pass it and let the
      // chain resolve, and the bar's deadline must be on the flag for every client to read.
      const resolved = await waitFor(() => {
        const h = game.messages.get(msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'resolved' ? h : null;
      }, 20000);
      const dmg = await waitFor(() => damageFor(usageId), 12000).catch(() => null);
      results.timer = {
        hadDeadline: !!pending?.deadline, window: pending?.window ?? null,
        answer: resolved?.targets?.[0]?.answer ?? null,
        timedOut: !!resolved?.targets?.[0]?.timedOut,
        damageRolled: !!dmg,
      };
      await game.settings.set(MOD, 'holdTimer', 0);
      await gren.unsetFlag(MOD, 'reactionSpent');
    }

    // ---- 4f. HOPELESS HOLDS ARE SKIPPED (only under full disclosure) -------------------------
    // A reaction that cannot change the outcome is a false stop. Gated on reveal: with the
    // math hidden, a prompt that never appears would itself leak that the attack beat their
    // AC by more than the reaction could add.
    {
      await game.settings.set(MOD, 'holdReveal', true);
      await game.settings.set(MOD, 'holdSkipFutile', true);
      // Shield adds +5, so anything at or past AC+5 is hopeless. Find one.
      let hopeless = null;
      for (let i = 0; i < 40 && !hopeless; i++) {
        const a = await attackGren({ advantage: true });
        if (!a.crit && !a.fumble && (a.total >= baseAC + 5)) hopeless = a;
        else await sleep(80);
      }
      if (!hopeless) throw new Error(`no attack landed at or past AC ${baseAC + 5}`);
      await sleep(2500);
      results.futile = {
        attackTotal: hopeless.total, needed: baseAC + 5,
        held: !!game.messages.get(hopeless.msg.id)?.getFlag(MOD, 'hold'),
        damageRolled: !!damageFor(hopeless.usageId),
      };

      // ...but with the math hidden it must STILL hold, or its absence is the leak.
      await game.settings.set(MOD, 'holdReveal', false);
      await gren.unsetFlag(MOD, 'reactionSpent');
      let hidden = null;
      for (let i = 0; i < 40 && !hidden; i++) {
        const a = await attackGren({ advantage: true });
        if (!a.crit && !a.fumble && (a.total >= baseAC + 5)) hidden = a;
        else await sleep(80);
      }
      if (hidden) {
        const held = await waitFor(() => {
          const h = game.messages.get(hidden.msg.id)?.getFlag(MOD, 'hold');
          return h?.status === 'pending' ? h : null;
        }, 8000).catch(() => null);
        results.futileHidden = { attackTotal: hidden.total, held: !!held };
        // Clear it so it does not sit pending and pop at whoever is logged in.
        if (held) {
          const doc = game.messages.get(hidden.msg.id);
          const m = foundry.utils.deepClone(doc.getFlag(MOD, 'hold'));
          m.targets.forEach(t => { t.answer = t.answer ?? 'pass'; });
          await doc.setFlag(MOD, 'hold', m);
        }
      }
      await game.settings.set(MOD, 'holdReveal', true);
      await gren.unsetFlag(MOD, 'reactionSpent');
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
      // ⚠ The statblock fixture must never outlive the run. Section 4d proves that a mundane
      // shield does not hold the chain, and a leftover cast activity hands that same fixture a
      // REAL Shield — so the next run's 4d fails for a reason that has nothing to do with the
      // module. Swept here as well as in-section, because a throw skips the in-section teardown.
      const victimBase = game.actors.getName('BF Test Victim');
      const victimToken = victimBase
        ? game.scenes.getName('Battle Flow Test Range')?.tokens.find(t => t.actorId === victimBase.id)
        : null;
      if (victimToken?.actor) await sweepCastFixture(victimToken.actor);

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
report('STATBLOCK: a feature\'s cast activity holds the chain',
  x.statblockCast?.pending === true && x.statblockCast?.reaction === 'Shield',
  `pending=${x.statblockCast?.pending}, reaction=${x.statblockCast?.reaction}`);
report('STATBLOCK: the hold records the feature id AND the cast activity id',
  x.statblockCast?.itemIdOK === true && x.statblockCast?.activityIdOK === true,
  `recorded ${x.statblockCast?.recorded}, expected ${x.statblockCast?.expected}`);
report('STATBLOCK: the Cast control spends the ACTIVITY\'s use, never a spell slot',
  x.statblockCast?.answered === 'cast' && x.statblockCast?.usesSpent === 1
  && x.statblockCast?.slotsUnchanged === true,
  `answer=${x.statblockCast?.answered}, uses ${x.statblockCast?.usesLabel}, `
  + `slots unchanged: ${x.statblockCast?.slotsUnchanged}`);
report('STATBLOCK: the effect lands from the LINKED spell and AC moves +5',
  x.statblockCast?.effectApplied === true
  && x.statblockCast?.acAfter === x.statblockCast?.acBefore + 5,
  `AC ${x.statblockCast?.acBefore} → ${x.statblockCast?.acAfter}, effect: ${x.statblockCast?.effectApplied}`);
report('STATBLOCK: the verdict flips the hit to a miss and no damage rolls',
  x.statblockCast?.verdict === 'miss' && x.statblockCast?.damageRolled === false,
  JSON.stringify(x.statblockCast));
report('STATBLOCK: the table is told the reaction WORKED, not that it never applied',
  x.statblockCast?.announced === 'worked',
  `announced: ${x.statblockCast?.announced}`);
report('STATBLOCK: an AT-WILL cast activity (no pool at all) still holds',
  x.atWillCast?.held === true && x.atWillCast?.reaction === 'Shield'
  && x.atWillCast?.usesMax === '' && x.atWillCast?.consumptionTargets === 0,
  JSON.stringify(x.atWillCast));
report('PC → MONSTER: a PC attack holds on the monster\'s reaction and resolves to a miss',
  x.pcVsMonster?.attackerType === 'character' && x.pcVsMonster?.held === true
  && x.pcVsMonster?.answered === 'cast' && x.pcVsMonster?.verdict === 'miss'
  && x.pcVsMonster?.damageRolled === false,
  JSON.stringify(x.pcVsMonster));
report('PC → MONSTER: with auto-damage on NPCs only, a PC attack never holds',
  x.pcVsMonster?.modeNpcHeld === false && x.pcVsMonster?.modeNpcDamage === false,
  `held=${x.pcVsMonster?.modeNpcHeld}, damage=${x.pcVsMonster?.modeNpcDamage}`);
report('an NPC holds a spell paid for by x/x uses, with no slots at all',
  x.npcUsesSpell?.held === true && x.npcUsesSpell?.reaction === 'Shield',
  JSON.stringify(x.npcUsesSpell));
report('the timer passes an unanswered hold and the chain resolves',
  x.timer?.hadDeadline === true && x.timer?.answer === 'pass'
  && x.timer?.timedOut === true && x.timer?.damageRolled === true,
  JSON.stringify(x.timer));
report('a hopeless hold is skipped when the math is shown',
  x.futile?.held === false && x.futile?.damageRolled === true,
  JSON.stringify(x.futile));
report('...but is still offered when the math is hidden (absence would leak it)',
  x.futileHidden ? x.futileHidden.held === true : true,
  x.futileHidden ? JSON.stringify(x.futileHidden) : 'no qualifying attack rolled — not exercised');
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
