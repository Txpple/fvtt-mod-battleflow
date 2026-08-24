// Battle Flow Phase 1.5 smoke test — drives the reaction hold end to end in the live world,
// using GREN'S OWN SHIELD against a real attack. Asserts the whole shape — (gg)
// roll-now-apply-later since the v1.20.0 walk (the hold pauses the APPLICATION, never the
// dice; the darts' pattern on the attack chain):
//   hit on a Shield-holder → hold stamped pending AND damage rolls at once, born
//     attackHoldPending, unapplied
//   → cast answers the hold → live AC re-test → miss → the claim releases and the dice do
//     NOTHING (no receipt, no HP lost)
//   → pass answers the hold → the claim releases and the application lands (receipt)
//   → crit skips the hold entirely (a natural 20 hits regardless of AC)
//   → reaction-spent suppresses the next hold
// Restores every setting it touched, deletes its own chat messages, and leaves Gren's HP,
// AC and spell slots exactly as it found them.
//
// Sections (PLAN 1.1): `--section 4d3`, `--section 1,3`, `--list`. Setup and the `finally`
// teardown ALWAYS run; only the scenario blocks are skippable.
//
// ⚠ THIS SUITE GATES TWICE, and it has to. Its page half COLLECTS (`results.<key> = {...}`)
// and its Node half ASSERTS on what was collected — so gating only the page half would turn
// every skipped section into a row of FAILs against `undefined`. Each `report()` therefore
// sits under the same `want()` as the block that fills it, and the two lists are kept in step
// by the key each report reads.
//
// ⚠ §2 ("CAST answers it") is folded into §1 rather than given an id: it is written INSIDE
// §1's block, reading the very hold §1 stamped. Splitting them would be a rewrite, and they
// are one scenario — the hold fires, then the cast answers it.
import { announcePlan, connectSuite, sectionPlan } from './harness.mjs';

const SECTIONS = {
  1: 'the hold fires (and §2: CAST answers it, the AC re-test turns the hit)',
  3: 'PASS lets the attack through: the released dice APPLY',
  4: 'reaction already spent ⇒ no hold at all',
  '4a2': 'an AC reaction ALREADY STANDING ⇒ no hold (finding ⑥)',
  '4b': 'the REAL cast path, on a GM-answerable stand-in',
  '4b2': 'ONE casting answers MANY holds, and lands exactly ONE effect',
  '4c': 'the SAFETY NET: a cast whose client never applied the effect',
  '4d': 'a NAME MATCH is not a reaction',
  '4d2': 'the MONSTER pattern: a spell paid for by x/x uses, no slots',
  '4d3': 'the STATBLOCK cast-activity path, end to end',
  '4d4': 'the AT-WILL variant: no pool at all still holds',
  '4d5': 'a PC attacks a monster that holds a reaction',
  '4d6': 'a FLAT AC cannot receive the reaction, and the card must say so',
  '4e': 'the TIMER: an unanswered hold passes itself',
  '4f': 'hopeless holds are skipped (only under full disclosure)',
  5: 'a natural 20 skips an AC-type hold',
  6: 'the SECOND TRIGGER: Magic Missile holds for Shield',
  // ⚠ Added 2026-08-23 because the D11 coverage report found that NO SUITE IN THE BATTERY EVER
  // CREATED A COMBAT — so `updateCombat`/`deleteCombat`, the whole reactionSpent lifecycle, had
  // never run under test. It creates a real Combat and deletes it in a `finally`.
  7: 'the PER-TURN CLEARS: reactionSpent set only in combat, cleared on turn and on delete'
};
// Every scenario stamps its own hold on its own attack and restores what it changed, so none
// of them names another. §4b and §4c both read `results.realCast` — that is one section's data
// asserted in two places, not a dependency.
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const want = id => !plan || plan.includes(String(id));
// Raised from 420s when the statblock cast-activity sections landed: each of the three hunts
// for an attack inside a 5-wide AC window, and a suite that dies at the watchdog reports
// nothing at all — the one failure mode with no diagnostic value.
const f = await connectSuite({ tag: 'hold', watchdogMs: 600_000 });
announcePlan('hold', plan, pulled);

let failures = 0;
const report = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

// The whole scenario runs in ONE page context so state stays coherent across steps.
const r = await f.evaluate(async ({ sections }) => {
  const MOD = 'fvtt-mod-battleflow';
  // The section gate, page side — the closure is serialized into the page, so the plan
  // arrives as DATA. The Node half above spells the same predicate for the reports.
  const want = id => !sections || sections.includes(String(id));
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
        blockList: game.settings.get(MOD, 'blockList'),
        holdSettle: game.settings.get(MOD, 'holdSettle'),
        holdReveal: game.settings.get(MOD, 'holdReveal'),
        holdTimer: game.settings.get(MOD, 'holdTimer'),
        holdSkipFutile: game.settings.get(MOD, 'holdSkipFutile'),
        holdApplyEffect: game.settings.get(MOD, 'holdApplyEffect'),
        requireTarget: game.settings.get(MOD, 'requireTarget'),
        castApply: game.settings.get(MOD, 'castApply'),
        masteryRiders: game.settings.get(MOD, 'masteryRiders'),
        volleys: game.settings.get(MOD, 'volleys'),
      },
      grenHP: foundry.utils.deepClone(gren.system._source.attributes.hp),
      grenAC: foundry.utils.deepClone(gren.system._source.attributes.ac),
      grenSlots: foundry.utils.deepClone(gren.system._source.spells),
    };
    await game.settings.set(MOD, 'autoDamage', 'all');
    await game.settings.set(MOD, 'autoApply', true);
    await game.settings.set(MOD, 'dramaticBeat', 0);
    await game.settings.set(MOD, 'reactionHold', true);
    // Pinned rather than assumed: section 6 is the whole of the second trigger, and a world
    // where someone has emptied this list would report it as broken instead of as switched off.
    await game.settings.set(MOD, 'blockList', 'Magic Missile:Shield');
    await game.settings.set(MOD, 'holdSettle', 6);
    await game.settings.set(MOD, 'holdApplyEffect', true);
    await game.settings.set(MOD, 'holdReveal', true);
    // ⚠ OFF for the classic sections, which assume every hit holds. With it on, any attack
    // landing 5+ over Gren's AC is correctly skipped as hopeless and those sections fail with
    // "hold never went pending" — the feature working, not breaking. Section 4f owns it.
    await game.settings.set(MOD, 'holdSkipFutile', false);
    await game.settings.set(MOD, 'holdTimer', 0);
    await game.settings.set(MOD, 'requireTarget', false);
    // ⚠ Pinned ON, deliberately — the table runs both. Shield is itself a utility-with-
    // effects cast, and the first battery with this on caught the cast slice stacking a
    // second +5 on the reaction's own application (+10 AC, two chips, 2026-08-16). The
    // affects-self gate in castApplyQualifies is what keeps the two machines apart; this
    // pin is its permanent regression net.
    await game.settings.set(MOD, 'castApply', true);
    // ⚠ Masteries are OUT OF SCOPE here and must be pinned OFF: the windowed attack
    // searches miss constantly, and a PC attacker whose blade sits on Graze (an aborted
    // smoke-effects run leaves the last setMastery in place) pays its flat ability mod
    // to the stand-in on every one of those misses — a deterministic -3 that broke the
    // negate section's hpBefore===hpMax guard on 2026-08-19.
    await game.settings.set(MOD, 'masteryRiders', false);
    // ⚠ Volleys are OUT OF SCOPE here and must be pinned OFF (v1.20.0, the masteryRiders
    // precedent): Gren's real Magic Missile now carries the volley count, so with the fold
    // on, the spell-trigger sections get a volley popup beside the hold popup and the
    // dialog searches find the wrong window. The volley×hold CLAIM compose is pinned in
    // smoke-volleys §6; this suite owns the hold alone.
    await game.settings.set(MOD, 'volleys', false);

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
    // ⚠ `live: true` measures the hit against Gren's AC AT ROLL TIME instead of the captured
    // `baseAC`. §4a2 raises a standing Shield on purpose (+5 → 17), so a "hit" of 12–16 by the
    // base measure is a MISS to the module, no damage rolls, and "damage flows" fails — which
    // is exactly what it did on roughly half of all runs from v1.15.0 until 2026-08-19, when
    // the assert was finally run more than once in a sitting. It passed at v1.15.0 on a lucky
    // roll and was recorded as green. The diagnose() comment below already warned about this
    // shape for a STRAY effect; the one section that raises the effect DELIBERATELY was still
    // using the base test. A flaky assert is worse than no assert — it gets blamed on whatever
    // change happens to be in flight.
    const plainHitOnGren = async ({ window = false, live = false } = {}) => {
      const tries = (window || live) ? 40 : 12;
      for (let i = 0; i < tries; i++) {
        const floor = live ? (gren.system.attributes.ac.value ?? baseAC) : baseAC;
        const a = await attackGren((window || live) ? { advantage: true } : {});
        const hits = a.total >= floor;
        const flips = !window || (a.total < baseAC + 5);
        if (!a.crit && !a.fumble && hits && flips) return a;
        log.push(`discarded: total=${a.total} crit=${a.crit} fumble=${a.fumble} (AC ${floor})`);
        await sleep(120);
      }
      throw new Error(`could not roll a plain hit${window ? ` in [${baseAC}, ${baseAC + 4}]` : ''}${live ? ' over Gren\'s LIVE AC' : ''} in ${tries} attempts`);
    };
    // ⚠ Search the WHOLE log, not a tail window. An originating id is unique to one attack, so
    // a wider search cannot produce a false positive — but a tail window produces false
    // NEGATIVES: these sections fire up to 60 attacks, and a late-resolving stray hold injects
    // announcement messages that push a real damage card out of a 14-message tail. That flaked
    // two assertions on 2026-08-15 ("damage flows" and the crit skip) and cost a bisect.
    const damageFor = usageId => game.messages.contents.find(m =>
      m.getFlag('dnd5e', 'roll.type') === 'damage'
      && m.getFlag('dnd5e', 'originatingMessage') === usageId);

    // (gg) roll-now-apply-later: the shape of a held attack's damage in one read. `rolled`
    // is the dice existing (they always do now), `pending` the attackHoldPending claim
    // (true while the hold is open, false once released, undefined on a never-held roll),
    // `applied` the receipt — the only proof damage actually LANDED.
    const dmgStateFor = usageId => {
      const m = damageFor(usageId);
      return { rolled: !!m,
        pending: m ? (m.getFlag(MOD, 'attackHoldPending') ?? null) : null,
        applied: !!m?.getFlag(MOD, 'receipt') };
    };

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
      // Fresh slots, full HP and a clean slate every run.
      //
      // ⚠ HP IS A RESOURCE TOO, and forgetting it makes damage assertions LIE. The sections
      // above fire real attacks at this stand-in with auto-apply on, so by section 6 it sits at
      // 0 HP — where "took no damage" and "took the lot" are the same observation. The negate
      // assertion passed 0 → 0 while proving nothing, and its Pass counterpart failed only
      // because HP clamps at zero (2026-08-15). Reset it here so every section starts whole.
      await actor.update({
        'system.spells.spell1.value': actor.system.spells.spell1.max || 4,
        'system.attributes.hp.value': actor.system.attributes.hp.max,
        'system.attributes.hp.temp': 0,
      });
      await actor.unsetFlag(MOD, 'reactionSpent');
      for (const e of actor.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
      // ⚠ A clean slate includes the CHAT. The windowed search loops above leave stray
      // PENDING holds on this stand-in (only the in-window attempt gets answered), and one
      // real cast answers EVERY pending hold for its target — whole-log by design since
      // v1.3.1, asserted as a feature in 4b2. So a later section's cast resolved the strays
      // too, their continuations re-tested, still hit, and auto-applied REAL damage mid-
      // section: the negate case read hpBefore 18/26 from exactly this (2026-08-16, twice,
      // variable amounts — a probe of the isolated section showed no loss and named the
      // bleed). Deleting the stray messages kills their holds outright.
      const strays = game.messages.filter(m => {
        const h = m.getFlag(MOD, 'hold');
        return (h?.status === 'pending') && h.targets?.some(t => (t.uuid === actor.uuid) && !t.answer);
      });
      if (strays.length) await ChatMessage.deleteDocuments(strays.map(m => m.id));
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
    const ensureCastStatblock = async ({ atWill = false, flatAC = false } = {}) => {
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

      // ⚠ AC calculation is load-bearing, and getting this wrong once already let a live bug
      // through. dnd5e's prepareArmorClass RETURNS on the `flat` branch before ac.bonus is
      // added — and ac.bonus is the one field Shield's effect writes — so on a flat statblock
      // the +5 lands as an effect and is then ignored by the system. `natural` (what 383 of the
      // Monster Manual's 500 statblocks use) adds it; `flat` cannot.
      //
      // Default `natural` = the correct statblock, where the whole chain must work. `flatAC` =
      // the broken statblock, where the module's only job is to SAY SO. Testing only the first
      // is exactly how this suite stayed green while the table was broken (2026-08-15).
      await base.update(flatAC
        ? { 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 13 }
        : { 'system.attributes.ac.calc': 'natural', 'system.attributes.ac.flat': 13 });
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

    // The popup's OWN Cast control. Driving this rather than a hand-rolled `use` is the
    // point: it is the control that shipped once as a button that answered without casting,
    // and it is the only path that exercises the itemId/activityId the hold recorded. The
    // card-only mode left with the settings collapse (2026-08-16), so the popup is THE
    // surface — found through the module's own livePopups registry (ESM singleton), never
    // by scraping dialog text.
    const { livePopups: LP } = await import('/modules/fvtt-mod-battleflow/scripts/ui.js');
    const holdPopupFor = messageId => {
      for (const [k, d] of LP.entries()) if (k.startsWith(`${messageId}|`) || (k === messageId)) return d;
      return null;
    };
    const popupButtons = messageId => {
      const el = holdPopupFor(messageId)?.element;
      return el ? [...el.querySelectorAll('footer button, .form-footer button')] : [];
    };
    // The popup names the reaction on its button ("Cast Shield"); the shape assertions
    // normalize that back to the binary pair.
    const castButtonFor = messageId => popupButtons(messageId)
      .find(b => b.textContent.trim().startsWith('Cast'));
    const buttonShapeOf = messageId => [...new Set(popupButtons(messageId)
      .map(b => b.textContent.trim()).map(t => t.startsWith('Cast') ? 'Cast' : t))].join('/');

    /**
     * How the module DESCRIBED a resolved hold, as one token. The card is the table's record and
     * its wording is computed separately from the verdict — from whether the module can see the
     * reaction's effect and, now, why it could not land — so it can be wrong entirely on its
     * own. Both bugs found on 2026-08-15 were visible only here.
     *
     * ⚠ Test 'fixed number' FIRST: the flat-AC card carries the same "not applied" eyebrow.
     */
    const announcementFor = name => {
      const m = game.messages.contents.slice().reverse().find(msg =>
        (msg.speaker?.alias === 'Battle Flow') && msg.content.includes(name ?? ' '));
      if (!m) return 'none';
      return m.content.includes('fixed number') ? 'flat-ac'
        : m.content.includes('not applied') ? 'not-applied'
          : m.content.includes('it worked') ? 'worked'
            : m.content.includes('not enough') ? 'not-enough' : 'other';
    };

    // ---- 1. the hold fires — and since (gg) the dice roll ANYWAY, born claimed -------------
    // v1.20.0 walk-1 ruling: the hold pauses the APPLICATION, never the roll ("the shoudl
    // just roll damage, and not wait for shield"). The roll must exist while the hold is
    // still pending, carry the attackHoldPending claim, and NOT be applied yet.
    if (want('1')) {
      const { usageId, msg, total } = await plainHitOnGren({ window: true });
      const held = await waitFor(() => {
        const h = game.messages.get(msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'pending' ? h : null;
      });
      const rolled = await waitFor(() => damageFor(usageId), 8000);
      await sleep(1200); // give a (wrong) premature application time to stamp its receipt
      results.holdFired = {
        pending: !!held,
        reaction: held?.targets?.[0]?.reaction,
        kind: held?.targets?.[0]?.kind,
        total,
        dmg: dmgStateFor(usageId),
        rolledWhileHeld: !!rolled && (game.messages.get(msg.id)?.getFlag(MOD, 'hold')?.status === 'pending'),
        claimNamesAttack: rolled?.getFlag(MOD, 'attackFor') === msg.id,
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
      // (gg): resolution RELEASES the claim (pending → false); the miss verdict then drops
      // Gren from hitTargets, so the released dice apply to nobody — no receipt, no HP.
      const released = await waitFor(() =>
        damageFor(usageId)?.getFlag(MOD, 'attackHoldPending') === false, 10000);
      await sleep(1200);
      results.castResolves = {
        resolved: !!resolved,
        verdict: resolved?.targets?.find(t => t.uuid === gren.uuid)?.verdict,
        liveAC: gren.system.attributes.ac.value,
        attackTotal: total,
        released: !!released,
        dmg: dmgStateFor(usageId),
        hpUnchanged: gren.system._source.attributes.hp.value === hpBefore,
      };
      for (const e of gren.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
      await gren.unsetFlag(MOD, 'reactionSpent');
    }

    // ---- 3. PASS lets the attack through: the released dice APPLY --------------------------
    // (gg): the roll already exists from attack time; the pass verdict keeps the hit, so the
    // release must end in a real application — the receipt is the proof, not the dice.
    if (want('3')) {
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
      const applied = await waitFor(() =>
        damageFor(usageId)?.getFlag(MOD, 'receipt') ?? null, 15000);
      results.passProceeds = { held: !!held, damageRolled: !!dmg,
        released: dmg?.getFlag(MOD, 'attackHoldPending') === false, applied: !!applied };
      await gren.unsetFlag(MOD, 'reactionSpent');
    }

    // ---- 4. reaction already spent ⇒ no hold at all -----------------------------------------
    if (want('4')) {
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

    // ---- 4a2. an AC reaction ALREADY STANDING ⇒ no hold (v1.15.0 walk finding ⑥) ------------
    // "if they have shield up, just dont prompt for shield" (user, 2026-08-19). Gren was
    // re-prompted with his +5 already active — a choice that changes nothing. Deliberately
    // independent of reactionSpent and of combat rounds: the walk reproduced it OUT of
    // combat, where reactionSpent is never set at all.
    if (want('4a2')) {
      await gren.unsetFlag(MOD, 'reactionSpent');
      const shieldItem = gren.items.find(i => (i.name.toLowerCase() === 'shield')
        && i.effects.size);
      const src = shieldItem?.effects.contents[0];
      let standing = null;
      if (src) {
        const data = src.toObject();
        data.disabled = false;
        data.origin = src.uuid;
        [standing] = await gren.createEmbeddedDocuments('ActiveEffect', [data]);
      }
      // LIVE AC, not base — the standing Shield above just moved it +5, and this assert's
      // second half ("damage flows") can only be true of an attack that actually connects.
      const { usageId, msg, total } = await plainHitOnGren({ live: true });
      await sleep(2500);
      results.standingSuppresses = {
        hadSource: !!src,
        effectUp: !!(standing && gren.effects.get(standing.id)),
        held: !!game.messages.get(msg.id)?.getFlag(MOD, 'hold'),
        damageRolled: !!damageFor(usageId),
        why: diagnose(usageId, total),
      };
      if (standing) await gren.effects.get(standing.id)?.delete();
      await gren.unsetFlag(MOD, 'reactionSpent');
    }

    // ---- 4b. THE REAL CAST PATH, on a GM-answerable stand-in --------------------------------
    // A copy of Gren's actual Shield on the test NPC: the GM can answer for it, so the whole
    // production chain runs for real — cast → module applies the effect → AC moves → the
    // hold re-tests against it. This is the path that was silently broken until now, because
    // Shield's +5 lives in an effect nobody had pressed.
    if (want('4b')) {
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
      const castButton = await waitFor(() => castButtonFor(atk.msg.id), 8000);
      if (!castButton) throw new Error('the hold popup rendered no Cast button for a GM-owned target');
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
        dmg: dmgStateFor(atk.usageId),
        slotsBefore,
        slotsAfter: victimActor.system.spells.spell1.value,
        usedCardButton: !!castButton,
        // v1.8.0 (the convergence): the reaction's effect leaves a standard receipt — on the
        // OLDEST pending hold the cast answered (one cast answers many holds; the effect
        // landed once, so the receipt rides the first answer, which is not necessarily the
        // attack this section watched: the retry loop above can leave older strays). Probe:
        // probe-reaction-receipt.mjs. Assert the receipt exists for the shielder EXACTLY
        // once, wherever the machine put it.
        effectReceipt: (() => {
          const holders = game.messages.contents.filter(m =>
            m.getFlag(MOD, 'effectReceipt')?.targets?.some(t => t.uuid === victimActor.uuid));
          const eff = holders
            .flatMap(m => m.getFlag(MOD, 'effectReceipt').targets)
            .filter(t => t.uuid === victimActor.uuid)
            .flatMap(t => t.effects ?? [])
            .find(e => e.name === 'Imperceptible Barrier');
          return { present: !!eff, messages: holders.length, name: eff?.name ?? null,
            marked: eff ? (victimActor.effects.get(eff.id)?.getFlag(MOD, 'reactionEffect') === true) : false,
            live: !!(eff && victimActor.effects.get(eff.id)) };
        })(),
      };
      for (const e of victimActor.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
      await victimActor.unsetFlag(MOD, 'reactionSpent');
    }

    // ---- 4b2. ONE casting answers MANY holds, and lands exactly ONE effect -------------------
    // A multiattack that lands twice stamps two holds on the same target; RAW the one Shield
    // covers both. The cast used to spawn its work per hold, concurrently, so each application
    // read the actor's effects before any other had written one and each created its own —
    // +10 AC from a single casting. Deterministic here: stamp exactly two holds, cast once.
    if (want('4b2')) {
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

      // ONE cast, driven from the first hold's popup.
      const castButton = await waitFor(() => castButtonFor(held[0]), 8000);
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
    if (want('4c')) {
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
        dmg: dmgStateFor(atk.usageId),
      };
      for (const e of victimActor.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
      await victimActor.unsetFlag(MOD, 'reactionSpent');
    }

    // ---- 4d. A NAME MATCH IS NOT A REACTION --------------------------------------------------
    // A hobgoblin WEARS a shield: an `equipment` item literally named "Shield". It matched the
    // interrupt list on name alone, so every shield-carrying monster in the world held the
    // chain for a spell it cannot cast — "Hobgoblin — Shield?" on a creature with no spells at
    // all (reported live 2026-08-15). Eleven such items existed in the world at the time.
    if (want('4d')) {
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
    if (want('4d2')) {
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
    if (want('4d3')) {
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

      // ⚠ Exactly two controls, and the SAME two a player gets. A GM-only third button ("Skip")
      // shipped here until v1.1.15: it ran the same code as Pass — the whole chain only ever
      // asks `answer === "cast"` — so it was one decision with three controls, and it made the
      // GM's surface a different shape from the player's for no behavioural difference at all.
      // Deduped: a message renders into several DOM trees, so the raw list repeats.
      await waitFor(() => popupButtons(atk.msg.id).length, 8000);
      const buttonShape = buttonShapeOf(atk.msg.id);

      const button = pending ? castButtonFor(atk.msg.id) : null;
      if (pending && !button) throw new Error('the hold popup rendered no Cast button for the statblock caster');
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
      const announced = announcementFor(heldTarget?.name);

      results.statblockCast = {
        announced,
        buttonShape,
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
        dmg: dmgStateFor(atk.usageId),
        attackTotal: atk.total,
      };
      await clearBarriers(npc);
      await npc.unsetFlag(MOD, 'reactionSpent');
    }

    // ---- 4d4. THE AT-WILL VARIANT: no pool at all still holds ---------------------------------
    // Inverted from the spell-item rule and easy to break: on a cast activity an empty `uses`
    // means the monster can do it all day, not that it is out of charges. The Green Hag carries
    // two spells exactly like this.
    if (want('4d4')) {
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
    if (want('4d5')) {
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
      const button = pending ? await waitFor(() => castButtonFor(atk.msg.id), 8000) : null;
      if (pending && !button) throw new Error('the hold popup rendered no Cast button on the PC attack');
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
        dmg: dmgStateFor(atk.usageId),
        attackTotal: atk.total,
      };
      await clearBarriers(npc);
      await npc.unsetFlag(MOD, 'reactionSpent');
      await sweepCastFixture(npc);
    }

    // ---- 4d6. A FLAT AC CANNOT RECEIVE THE REACTION, AND THE CARD MUST SAY SO -----------------
    // dnd5e's prepareArmorClass RETURNS on the flat branch before ac.bonus is added ("Flat AC
    // (no additional bonuses)"), so a statblock whose AC is a fixed number ignores every AC
    // effect — Shield's included. The effect lands, the number does not move, and the attack
    // still hits. The module cannot fix that; what it must not do is describe it as "its AC has
    // not arrived", which reads as a module bug and sent a live debugging session chasing one
    // (2026-08-15, a hand-authored Skeletal Mage whose AC was pinned flat).
    //
    // ⚠ This section exists because every other statblock section uses `natural` and therefore
    // could never have caught it: the suite was green while the table was broken.
    if (want('4d6')) {
      const { actor: npc, token: npcToken } = await ensureCastStatblock({ flatAC: true });
      const vAC = npc.system.attributes.ac.value;
      const atk = await attackIntoFlipWindow(activity, npcToken, vAC);
      if (!atk) throw new Error(`no attack landed in [${vAC}, ${vAC + 4}] against the flat-AC caster`);

      const pending = await waitFor(() => {
        const h = game.messages.get(atk.msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'pending' ? h : null;
      });
      const button = pending ? await waitFor(() => castButtonFor(atk.msg.id), 8000) : null;
      if (pending && !button) throw new Error('the hold popup rendered no Cast button on the flat-AC caster');
      button?.click();
      const done = pending ? await waitFor(() => {
        const h = game.messages.get(atk.msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'resolved' ? h : null;
      }, 30000) : null;
      await sleep(1200);

      results.flatAC = {
        held: !!pending,
        acCalc: npc.system.attributes.ac.calc,
        effectLanded: !!npc.effects.find(e => e.name === 'Imperceptible Barrier' && !e.disabled),
        acBefore: vAC,
        acAfter: npc.system.attributes.ac.value,   // UNCHANGED: the system ignores the bonus
        verdict: done?.targets?.[0]?.verdict ?? null,
        announced: announcementFor(done?.targets?.[0]?.name),
        attackTotal: atk.total,
      };
      await clearBarriers(npc);
      await npc.unsetFlag(MOD, 'reactionSpent');
      await sweepCastFixture(npc);
    }

    // ---- 4e. THE TIMER: an unanswered hold passes itself ------------------------------------
    if (want('4e')) {
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
    if (want('4f')) {
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
    if (want('5')) {
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

    // ---- 6. THE SECOND TRIGGER: Magic Missile holds for Shield, and Shield really stops it ----
    // Shield's text is "+5 AC … AND you take no damage from Magic Missile", and that second half
    // is unreachable from an attack roll — Magic Missile has none. So this section drives the
    // OTHER entry point end to end: a spell USAGE stamps a `negate` hold on its own usage card,
    // and the answer alone is the verdict.
    //
    // ⚠ The load-bearing assertion is the LAST one in each case: damage is rolled and then
    // applied exactly as the native tray applies it, and the shielded target's HP must not
    // move. Everything before it only proves the module talked about a block; only applying
    // real damage proves there was one.
    if (want('6')) {
      const MM_UUID = 'Compendium.dnd-players-handbook.spells.Item.phbsplMagicMissi';

      // ⚠ Cast with NO slot cost. An NPC's spell-slot maxima are DERIVED from a caster level
      // most statblocks never set, so they recompute to 0 and a slot-consuming cast is simply
      // refused — and innate/at-will is the shape a monster casts in anyway. Nothing here
      // depends on how the spell was paid for; the hold is what is on trial.
      const ensureMissile = async () => {
        let item = attacker.items.find(i => i.name === 'Magic Missile' && i.type === 'spell');
        if (!item) {
          const src = (await fromUuid(MM_UUID)).toObject();
          delete src._id;
          for (const a of Object.values(src.system.activities ?? {})) {
            if (a.consumption) a.consumption.spellSlot = false;
          }
          src.system.prepared = 1;
          [item] = await attacker.createEmbeddedDocuments('Item', [src]);
          log.push('created Magic Missile on BF Test Attacker');
        }
        const act = item.system.activities?.contents?.[0];
        if (!act) throw new Error('Magic Missile fixture has no activity');
        if (act.type !== 'damage') throw new Error(`Magic Missile activity is ${act.type}, not damage`);
        return item;
      };
      const missile = () => attacker.items
        .find(i => i.name === 'Magic Missile' && i.type === 'spell')
        ?.system.activities?.contents?.[0];

      // Fire Magic Missile at one token and return its usage card.
      const castMissileAt = async tokenObj => {
        tokenObj.setTarget(true, { releaseOthers: true });
        const usage = await missile().use({ subsequentActions: false }, { configure: false }, {});
        return usage?.message ?? null;
      };

      // Roll the spell's damage, then let the v1.6.0 auto-applier do its work — or prove it
      // does NOT. expectApply:true waits for the receipt (the elect applying a resolved
      // hold's damage per verdicts); expectApply:false gives a wrong auto-apply every
      // chance to happen, then makes the native tray's EXACT applyDamage call by hand —
      // the live-fire exercise the veto has to survive (damage-application.mjs:335).
      const rollAndAwaitAuto = async (usageMsg, actor, { expectApply }) => {
        const rolls = await missile().rollDamage({}, { configure: false },
          { data: { 'flags.dnd5e.originatingMessage': usageMsg.id } });
        const damageMsg = rolls?.[0]?.parent;
        if (!damageMsg) throw new Error('Magic Missile rolled no damage message');
        const damages = dnd5e.dice.aggregateDamageRolls(damageMsg.rolls, { respectProperties: true })
          .map(r => ({
            value: Math.max(0, r.total), type: r.options.type,
            properties: new Set(r.options.properties ?? []),
          }));
        const rolled = damages.reduce((sum, d) => sum + d.value, 0);
        const hpBefore = actor.system.attributes.hp.value;
        if (expectApply) {
          await waitFor(() => game.messages.get(damageMsg.id)?.getFlag(MOD, 'receipt') ?? null, 15000);
        } else {
          await sleep(3000);
          await actor.applyDamage(damages, {
            multiplier: 1, isDelta: true, originatingMessage: damageMsg, origin: damageMsg,
          });
        }
        // hpMax travels with the result so the assertions can prove the target was WHOLE when
        // the damage landed — an actor at 0 makes "lost nothing" and "lost everything" identical.
        return {
          rolled, hpBefore, hpAfter: actor.system.attributes.hp.value,
          // effectiveMax, not max: a tempmax debuff (the Hollow's -3 on the Gren clone,
          // 2026-08-19) makes raw max unreachable — "whole" means effective max.
          hpMax: actor.system.attributes.hp.effectiveMax ?? actor.system.attributes.hp.max,
        };
      };

      await ensureMissile();

      // -- 6a/6b/6c: cast Shield → the spell is negated and its damage never lands ------------
      {
        const { actor: shielder, token: shielderToken } = await ensureShielder();
        const usageMsg = await castMissileAt(shielderToken);
        if (!usageMsg) throw new Error('Magic Missile created no usage card to hold');

        const pending = await waitFor(() => {
          const h = game.messages.get(usageMsg.id)?.getFlag(MOD, 'hold');
          return h?.status === 'pending' ? h : null;
        });

        // The control set is the same binary pair an attack hold offers — one decision, two
        // buttons, and no GM-only third (the v1.1.15 regression, guarded here too).
        await waitFor(() => popupButtons(usageMsg.id).length, 8000);
        const buttons = buttonShapeOf(usageMsg.id).split('/');
        const castButton = castButtonFor(usageMsg.id);
        if (!castButton) throw new Error('the spell hold popup rendered no Cast button');
        castButton.click();

        const done = await waitFor(() => {
          const h = game.messages.get(usageMsg.id)?.getFlag(MOD, 'hold');
          return h?.status === 'resolved' ? h : null;
        }, 25000);
        await sleep(1200);

        const applied = await rollAndAwaitAuto(usageMsg, shielder, { expectApply: false });
        results.missileNegated = {
          pending: !!pending,
          trigger: pending?.trigger ?? null,
          spell: pending?.spell ?? null,
          kind: pending?.targets?.[0]?.kind ?? null,
          reaction: pending?.targets?.[0]?.reaction ?? null,
          buttonShape: [...new Set(buttons)].join('/'),
          answered: done?.targets?.[0]?.answer ?? null,
          verdict: done?.targets?.[0]?.verdict ?? null,
          // Shield's +5 arrives too — casting it against Magic Missile is still casting Shield.
          effectApplied: !!shielder.effects.find(e =>
            e.name === 'Imperceptible Barrier' && !e.disabled),
          ...applied,
          // ⚠ Assert what the table is TOLD, not just what happened: both bugs found on
          // 2026-08-15 were visible only in the announcement.
          announced: game.messages.contents.slice(-12).some(m =>
            m.speaker?.alias === 'Battle Flow' && /does nothing to/i.test(m.content ?? '')),
        };
        for (const e of shielder.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
        await shielder.unsetFlag(MOD, 'reactionSpent');
      }

      // -- 6d: pass → the missiles land in full ----------------------------------------------
      {
        const { actor: shielder, token: shielderToken } = await ensureShielder();
        const usageMsg = await castMissileAt(shielderToken);
        const pending = await waitFor(() => {
          const h = game.messages.get(usageMsg.id)?.getFlag(MOD, 'hold');
          return h?.status === 'pending' ? h : null;
        });
        const passButton = await waitFor(() => popupButtons(usageMsg.id)
          .find(b => b.textContent.trim() === 'Pass'), 8000);
        if (!passButton) throw new Error('the spell hold popup rendered no Pass button');
        passButton.click();

        const done = await waitFor(() => {
          const h = game.messages.get(usageMsg.id)?.getFlag(MOD, 'hold');
          return h?.status === 'resolved' ? h : null;
        }, 25000);
        await sleep(800);

        const applied = await rollAndAwaitAuto(usageMsg, shielder, { expectApply: true });
        results.missilePassed = {
          pending: !!pending,
          answered: done?.targets?.[0]?.answer ?? null,
          verdict: done?.targets?.[0]?.verdict ?? null,
          ...applied,
        };
        await shielder.unsetFlag(MOD, 'reactionSpent');
      }

      // -- 6f: the claim → defer → release chain on the NATIVE card (v1.10.0: the ---------
      //        suppression replacement and its bridge are gone; the card is always the bus).
      //        The roll is chained the way the native subsequent roll chains itself
      //        (originatingMessage → the usage card); the claim defers the applier while
      //        the hold is pending, and the negated verdict releases it with the shielded
      //        target skipped.
      {
        const { actor: shielder, token: shielderToken } = await ensureShielder();
        const before = new Set(game.messages.contents.map(m => m.id));
        shielderToken.setTarget(true, { releaseOthers: true });
        await sleep(120);
        await missile().use({ subsequentActions: false }, { configure: false }, {});
        const freshMsgs = () => game.messages.contents.filter(m => !before.has(m.id));
        const holdMsg = await waitFor(() => freshMsgs().find(m =>
          m.getFlag(MOD, 'hold')?.status === 'pending') ?? null, 10000);
        const heldOnUsage = !!holdMsg && ((holdMsg.type === 'usage')
          || (holdMsg.getFlag('dnd5e', 'messageType') === 'usage'));
        const rolls = await missile().rollDamage({}, { configure: false },
          holdMsg ? { data: { 'flags.dnd5e.originatingMessage': holdMsg.id } } : {});
        const damageMsg = rolls?.[0]?.parent;
        // ⚠ Captured AT THE ROLL: the claim is stamped at preCreate (baked into the doc)
        // and the resolution releases it later — reading this flag after the answer reads
        // the released state and calls the machine broken (this suite's own first run).
        const pendingAtRoll = damageMsg?.getFlag(MOD, 'spellHoldPending') === true;
        const hpBefore = shielder.system.attributes.hp.value;
        // The defer is a real assertion: claimed + pending + nothing applied yet.
        await sleep(1500);
        const deferredHp = shielder.system.attributes.hp.value;
        const deferredReceipt = !!game.messages.get(damageMsg?.id)?.getFlag(MOD, 'receipt');
        const castBtn = await waitFor(() => castButtonFor(holdMsg?.id), 8000);
        castBtn?.click();
        await waitFor(() => (game.messages.get(holdMsg?.id)?.getFlag(MOD, 'hold')?.status === 'resolved')
          ? true : null, 25000);
        await sleep(3000); // the release write + any (wrong) application get every chance
        results.missileClaim = {
          held: !!holdMsg,
          heldOnUsage,
          claimed: damageMsg?.getFlag(MOD, 'spellDamage') === true,
          pendingAtRoll,
          deferredHeld: (deferredHp === hpBefore) && !deferredReceipt,
          pendingNow: game.messages.get(damageMsg?.id)?.getFlag(MOD, 'spellHoldPending'),
          hpBefore, hpAfter: shielder.system.attributes.hp.value,
          hpMax: shielder.system.attributes.hp.effectiveMax ?? shielder.system.attributes.hp.max,
          receipt: !!game.messages.get(damageMsg?.id)?.getFlag(MOD, 'receipt'),
        };
        for (const e of shielder.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
        await shielder.unsetFlag(MOD, 'reactionSpent');
      }

      // -- 6e: a target who cannot cast Shield is never asked ---------------------------------
      // The hobgoblin WEARS a shield. If the block list held on a name match the same way the
      // interrupt list once did, every armoured monster would stop a Magic Missile it has no
      // answer to. Swept first so a crashed earlier section cannot hand it a real Shield.
      {
        const victimBase = game.actors.getName('BF Test Victim');
        const victimDoc = victimBase ? scene.tokens.find(t => t.actorId === victimBase.id) : null;
        const victimActor = victimDoc?.actor;
        if (victimActor) {
          await sweepCastFixture(victimActor);
          const victimTokenObj = canvas.tokens.get(victimDoc.id);
          const usageMsg = await castMissileAt(victimTokenObj);
          await sleep(2500);
          results.missileNoReaction = {
            wearsShield: victimActor.items.some(i => i.name === 'Shield' && i.type !== 'spell'),
            knowsShieldSpell: victimActor.items.some(i => i.name === 'Shield' && i.type === 'spell'),
            held: !!game.messages.get(usageMsg?.id)?.getFlag(MOD, 'hold'),
          };
        } else {
          results.missileNoReaction = { skipped: true };
        }
      }

      // The fixture must not outlive the run: BF Test Attacker is the weapon attacker for every
      // other section, and a leftover Magic Missile is a spell item sitting on an NPC that has
      // no business knowing one.
      const leftover = attacker.items
        .filter(i => i.name === 'Magic Missile' && i.type === 'spell').map(i => i.id);
      if (leftover.length) await attacker.deleteEmbeddedDocuments('Item', leftover);
    }

    /* ---- 7: the per-turn clears — the two hooks nothing had ever exercised --------------- */
    if (want('7')) {
      // ⚠ WHY THIS SECTION EXISTS, and it is worth reading before trusting any other coverage
      // here: the FIRST full reading of the D11 hook-coverage report (2026-08-23) found that
      // **no suite in the entire battery had ever created a COMBAT**. So hold.js's
      // `updateCombat` and `deleteCombat` handlers — the whole lifecycle of `reactionSpent` —
      // had never once run under test, while every other part of the hold was covered heavily.
      // Nothing static could have found that; the ledger printed it in a line.
      //
      // ⚠ BOTH RULES ASSERTED HERE ARE SCAR TISSUE. The SET refuses out of combat because there
      // would be no turn to refresh the flag, and the actor would be stranded with reactions
      // permanently "spent". The CLEARS are deliberately NOT gated on the feature toggle,
      // because killing the hold mid-combat used to strand every flag already set. Both are
      // documented at the handlers; neither had a test.
      let combat = null;
      const spent = () => !!game.actors.get(gren.id).getFlag(MOD, 'reactionSpent');
      const shieldActivity = () => gren.items.get(shield.id)?.system.activities?.contents?.[0];
      const castShield = async () => {
        await shieldActivity()?.use({ subsequentActions: false }, { configure: false },
          { create: false });
        await sleep(500);
      };
      try {
        await gren.unsetFlag(MOD, 'reactionSpent');
        if (game.combat) await game.combat.delete();
        await sleep(300);

        // (a) OUT of combat, the set is REFUSED.
        await castShield();
        const outOfCombat = spent();

        // (b) IN a running combat, the same reaction DOES set it.
        // ⚠ TWO combatants, not one. With a single combatant Gren is current the instant the
        // combat starts, so there is no turn to advance TO and (c) could never be observed.
        const foeToken = scene.tokens.find(t => t.actorId === attacker.id)
          ?? scene.tokens.find(t => t.actorId !== gren.id);
        combat = await Combat.create({ scene: scene.id });
        await combat.createEmbeddedDocuments('Combatant', [
          { actorId: gren.id, tokenId: grenToken.id, sceneId: scene.id },
          ...(foeToken ? [{ actorId: foeToken.actorId, tokenId: foeToken.id, sceneId: scene.id }] : [])
        ]);
        await combat.rollAll();
        await combat.startCombat();
        await sleep(400);
        // ⚠ Step OFF Gren first if the initiative put us on him: `updateCombat` clears the flag
        // for whoever's turn it now is, so setting it while Gren is current would be cleared by
        // the very next tick and (c) would pass for the wrong reason.
        for (let i = 0; (i < 4) && (combat.combatant?.actor?.id === gren.id); i++) {
          await combat.nextTurn();
          await sleep(250);
        }
        const startedOnGren = combat.combatant?.actor?.id === gren.id;
        await gren.unsetFlag(MOD, 'reactionSpent');
        await castShield();
        const inCombat = spent();

        // (c) `updateCombat`: Gren's own turn comes round and the flag clears.
        let reached = false;
        for (let i = 0; i < 6; i++) {
          await combat.nextTurn();
          await sleep(300);
          if (combat.combatant?.actor?.id === gren.id) { reached = true; break; }
        }
        const clearedOnTurn = reached && !spent();

        // (d) `deleteCombat`: the fight ends and the flag clears FOR EVERY COMBATANT — ⚠ with
        // the feature toggle OFF, which is the whole point of the clears not being gated on it.
        await gren.setFlag(MOD, 'reactionSpent', true);
        await sleep(200);
        const setBeforeDelete = spent();
        await game.settings.set(MOD, 'reactionHold', false);
        await combat.delete();
        combat = null;
        await sleep(600);
        const clearedOnDelete = !spent();

        results.turnClears = {
          outOfCombatSet: outOfCombat, startedOnGren, inCombatSet: inCombat,
          turnReached: reached, clearedOnTurn, setBeforeDelete, clearedOnDelete
        };
      } finally {
        // ⚠ A LEFTOVER COMBAT WOULD POISON EVERY LATER SUITE — `inRunningCombat` is read by the
        // hold's own set path and by mastery's stamps. It goes, whatever happened above.
        await game.settings.set(MOD, 'reactionHold', true);
        try { if (combat) await combat.delete(); } catch { /* already gone */ }
        try { if (game.combat) await game.combat.delete(); } catch { /* ditto */ }
        await gren.unsetFlag(MOD, 'reactionSpent');
        await clearBarriers(gren);
      }
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

      // Same rule for section 6's Magic Missile: BF Test Attacker is the weapon attacker for
      // every other section and must not quietly become a spellcaster between runs. Swept here
      // as well as in-section, because a throw skips the in-section teardown.
      const attackerBase = game.actors.getName('BF Test Attacker');
      const strayMissiles = (attackerBase?.items ?? [])
        .filter(i => i.name === 'Magic Missile' && i.type === 'spell').map(i => i.id);
      if (strayMissiles.length) await attackerBase.deleteEmbeddedDocuments('Item', strayMissiles);

      const mine = game.messages.filter(m =>
        m.speaker?.alias?.startsWith('BF Test') || m.speaker?.alias === 'Battle Flow'
        || (m.speaker?.alias === 'Gren Greenmantle' && m.getFlag(MOD, 'respondsTo')));
      await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (cleanupErr) {
      console.error('cleanup failed', cleanupErr);
    }
  }
}, { sections: plan });

if (!r.ok) {
  console.error(`[hold] SETUP/RUN FAILED — ${r.why}`);
  process.exit(1);
}
const x = r.results;
if (want('1')) {
  report('hit on a Shield holder stamps a pending hold',
    x.holdFired?.pending && x.holdFired?.reaction === 'Shield' && x.holdFired?.kind === 'ac',
    JSON.stringify(x.holdFired));
  report('(gg) held attack rolls its damage IMMEDIATELY, born claimed and unapplied',
    x.holdFired?.rolledWhileHeld === true && x.holdFired?.dmg?.pending === true
    && x.holdFired?.claimNamesAttack === true && x.holdFired?.dmg?.applied === false,
    JSON.stringify({ dmg: x.holdFired?.dmg, whileHeld: x.holdFired?.rolledWhileHeld,
      names: x.holdFired?.claimNamesAttack }));
  report('cast → live-AC re-test turns the hit into a miss',
    x.castResolves?.resolved && x.castResolves?.verdict === 'miss',
    JSON.stringify(x.castResolves));
  report('(gg) a Shield-flipped miss releases the claim and the dice do NOTHING — no receipt, no HP',
    x.castResolves?.released === true && x.castResolves?.dmg?.pending === false
    && x.castResolves?.dmg?.applied === false && x.castResolves?.hpUnchanged === true,
    JSON.stringify({ released: x.castResolves?.released, dmg: x.castResolves?.dmg,
      hpUnchanged: x.castResolves?.hpUnchanged }));
}
if (want('3')) {
  report('(gg) pass → the release ends in a real application (receipt on the roll)',
    x.passProceeds?.held && x.passProceeds?.damageRolled
    && x.passProceeds?.released === true && x.passProceeds?.applied === true,
    JSON.stringify(x.passProceeds));
}
if (want('4')) {
  report('reaction already spent ⇒ no hold, damage flows',
    x.spentSuppresses?.held === false && x.spentSuppresses?.damageRolled === true,
    JSON.stringify(x.spentSuppresses));
}
if (want('4a2')) {
  // v1.15.0 walk finding ⑥. The hadSource/effectUp fields are part of the assertion, not
  // decoration: without them a fixture that never got the effect up would "pass" by proving
  // nothing at all — the 0-HP trap this suite already learned once.
  report('an AC reaction ALREADY STANDING ⇒ no hold, damage flows (finding ⑥)',
    x.standingSuppresses?.hadSource === true && x.standingSuppresses?.effectUp === true
    && x.standingSuppresses?.held === false && x.standingSuppresses?.damageRolled === true,
    JSON.stringify(x.standingSuppresses));
}
if (want('4b')) {
  report('REAL cast: the reaction answers its own hold', x.realCast?.pending && x.realCast?.answered === 'cast',
    `pending=${x.realCast?.pending}, answer=${x.realCast?.answered}, via card button=${x.realCast?.usedCardButton}`);
  report('REAL cast: the Cast control actually spends the slot (it is a cast, not a vote)',
    x.realCast?.slotsAfter === x.realCast?.slotsBefore - 1,
    `slots ${x.realCast?.slotsBefore} → ${x.realCast?.slotsAfter}`);
  report("REAL cast: the module lands the reaction's effect and AC moves +5",
    x.realCast?.effectApplied === true && x.realCast?.acAfter === x.realCast?.acBefore + 5,
    `AC ${x.realCast?.acBefore} → ${x.realCast?.acAfter}, effect applied: ${x.realCast?.effectApplied}`);
  report("REAL cast: the reaction's effect leaves exactly ONE receipt, live and marked (v1.8.0)",
    x.realCast?.effectReceipt?.present === true
      && x.realCast?.effectReceipt?.messages === 1
      && x.realCast?.effectReceipt?.name === 'Imperceptible Barrier'
      && x.realCast?.effectReceipt?.live === true
      && x.realCast?.effectReceipt?.marked === true,
    JSON.stringify(x.realCast?.effectReceipt));
}
if (want('4d3')) {
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
  report('STATBLOCK: the verdict flips the hit to a miss and the released dice apply to nobody',
    x.statblockCast?.verdict === 'miss' && x.statblockCast?.dmg?.rolled === true
    && x.statblockCast?.dmg?.pending === false && x.statblockCast?.dmg?.applied === false,
    JSON.stringify(x.statblockCast));
  report('STATBLOCK: the table is told the reaction WORKED, not that it never applied',
    x.statblockCast?.announced === 'worked',
    `announced: ${x.statblockCast?.announced}`);
  report('the hold offers ONE decision and TWO controls, the same two a player gets',
    x.statblockCast?.buttonShape === 'Cast/Pass',
    `buttons: ${x.statblockCast?.buttonShape} (a GM-only third button is the regression)`);
}
if (want('4d6')) {
  report('FLAT AC: the effect lands but the system ignores it, so the AC does not move',
    x.flatAC?.held === true && x.flatAC?.effectLanded === true
    && x.flatAC?.acAfter === x.flatAC?.acBefore && x.flatAC?.verdict === 'hit',
    JSON.stringify(x.flatAC));
  report('FLAT AC: the card blames the fixed AC, not the reaction',
    x.flatAC?.announced === 'flat-ac',
    `announced: ${x.flatAC?.announced} (must not be the generic "not applied")`);
}
if (want('4d4')) {
  report('STATBLOCK: an AT-WILL cast activity (no pool at all) still holds',
    x.atWillCast?.held === true && x.atWillCast?.reaction === 'Shield'
    && x.atWillCast?.usesMax === '' && x.atWillCast?.consumptionTargets === 0,
    JSON.stringify(x.atWillCast));
}
if (want('4d5')) {
  report('PC → MONSTER: a PC attack holds on the monster\'s reaction and resolves to a miss',
    x.pcVsMonster?.attackerType === 'character' && x.pcVsMonster?.held === true
    && x.pcVsMonster?.answered === 'cast' && x.pcVsMonster?.verdict === 'miss'
    && x.pcVsMonster?.dmg?.rolled === true && x.pcVsMonster?.dmg?.applied === false,
    JSON.stringify(x.pcVsMonster));
  report('PC → MONSTER: with auto-damage on NPCs only, a PC attack never holds',
    x.pcVsMonster?.modeNpcHeld === false && x.pcVsMonster?.modeNpcDamage === false,
    `held=${x.pcVsMonster?.modeNpcHeld}, damage=${x.pcVsMonster?.modeNpcDamage}`);
}
if (want('4d2')) {
  report('an NPC holds a spell paid for by x/x uses, with no slots at all',
    x.npcUsesSpell?.held === true && x.npcUsesSpell?.reaction === 'Shield',
    JSON.stringify(x.npcUsesSpell));
}
if (want('4e')) {
  report('the timer passes an unanswered hold and the chain resolves',
    x.timer?.hadDeadline === true && x.timer?.answer === 'pass'
    && x.timer?.timedOut === true && x.timer?.damageRolled === true,
    JSON.stringify(x.timer));
}
if (want('4f')) {
  report('a hopeless hold is skipped when the math is shown',
    x.futile?.held === false && x.futile?.damageRolled === true,
    JSON.stringify(x.futile));
  report('...but is still offered when the math is hidden (absence would leak it)',
    x.futileHidden ? x.futileHidden.held === true : true,
    x.futileHidden ? JSON.stringify(x.futileHidden) : 'no qualifying attack rolled — not exercised');
}
if (want('4d')) {
  report('a mundane shield (equipment, not a spell) never holds the chain',
    x.mundaneShield?.held === false && x.mundaneShield?.damageRolled === true
    && x.mundaneShield?.strayShieldSpell === false,
    JSON.stringify(x.mundaneShield));
}
if (want('4b2')) {
  report('ONE casting answers MANY holds and lands exactly ONE effect',
    x.oneCastOneEffect?.effectCount === 1
    && x.oneCastOneEffect?.acAfter === x.oneCastOneEffect?.acBefore + 5
    && x.oneCastOneEffect?.slotsSpent === 1,
    JSON.stringify(x.oneCastOneEffect));
  report('the second hold is answered by that same casting',
    x.oneCastOneEffect?.secondAnswered === 'cast',
    `second hold answer: ${x.oneCastOneEffect?.secondAnswered}`);
}
if (want('4b')) {
  report('REAL cast: the attack becomes a miss and the released dice apply to nobody',
    x.realCast?.verdict === 'miss' && x.realCast?.dmg?.rolled === true
    && x.realCast?.dmg?.pending === false && x.realCast?.dmg?.applied === false,
    JSON.stringify(x.realCast));
}
if (want('4c')) {
  report('SAFETY NET: a cast whose client applied nothing still reaches a miss',
    x.safetyNet?.verdict === 'miss' && x.safetyNet?.effectLanded === true
      && x.safetyNet?.dmg?.rolled === true && x.safetyNet?.dmg?.applied === false,
    JSON.stringify(x.safetyNet));
}
if (want('6')) {
  report('MAGIC MISSILE: a spell usage stamps a negate hold on its own usage card',
    x.missileNegated?.pending === true && x.missileNegated?.trigger === 'spell'
    && x.missileNegated?.spell === 'Magic Missile' && x.missileNegated?.kind === 'negate'
    && x.missileNegated?.reaction === 'Shield',
    JSON.stringify(x.missileNegated));
  report('MAGIC MISSILE: the spell hold offers the same two controls an attack hold does',
    x.missileNegated?.buttonShape === 'Cast/Pass',
    `buttons: ${x.missileNegated?.buttonShape}`);
  report('MAGIC MISSILE: casting Shield answers the hold and the verdict is "negated"',
    x.missileNegated?.answered === 'cast' && x.missileNegated?.verdict === 'negated',
    `answer=${x.missileNegated?.answered}, verdict=${x.missileNegated?.verdict}`);
  report('MAGIC MISSILE: the reaction still lands its own +5 effect',
    x.missileNegated?.effectApplied === true,
    `effect applied: ${x.missileNegated?.effectApplied}`);
  // The one that matters: real damage, applied exactly as the tray applies it, must not land.
  // ⚠ hpBefore === hpMax is part of the assertion, not decoration. Without it a stand-in that
  // arrived at 0 HP satisfies "lost nothing" while proving nothing at all — which is exactly how
  // this passed on 2026-08-15 before ensureShielder learned to heal.
  report('MAGIC MISSILE: real damage is applied and the shielded target loses NOTHING',
    x.missileNegated?.rolled > 0 && x.missileNegated?.hpBefore === x.missileNegated?.hpMax
    && x.missileNegated?.hpAfter === x.missileNegated?.hpBefore,
    `rolled ${x.missileNegated?.rolled}, HP ${x.missileNegated?.hpBefore} → `
    + `${x.missileNegated?.hpAfter} (max ${x.missileNegated?.hpMax})`);
  report('MAGIC MISSILE: the table is told the spell did nothing',
    x.missileNegated?.announced === true,
    `announced: ${x.missileNegated?.announced}`);
  // hpBefore > rolled keeps the arithmetic honest: HP clamps at 0, so a target that cannot
  // absorb the whole roll would read as a partial hit and this would fail for the wrong reason.
  report('MAGIC MISSILE: passing lets the missiles land in full',
    x.missilePassed?.pending === true && x.missilePassed?.verdict === 'hit'
    && x.missilePassed?.rolled > 0 && x.missilePassed?.hpBefore > x.missilePassed?.rolled
    && x.missilePassed?.hpAfter === x.missilePassed?.hpBefore - x.missilePassed?.rolled,
    JSON.stringify(x.missilePassed));
  report('MAGIC MISSILE v1.10.0: the hold lives on the NATIVE card; the chained roll is claimed and defers while pending',
    x.missileClaim?.held && x.missileClaim?.heldOnUsage
    && x.missileClaim?.claimed && x.missileClaim?.pendingAtRoll
    && x.missileClaim?.deferredHeld,
    JSON.stringify(x.missileClaim));
  report('MAGIC MISSILE v1.10.0: the negated verdict releases the claim and the applier skips the shielded target',
    (x.missileClaim?.pendingNow === false)
    && x.missileClaim?.hpBefore === x.missileClaim?.hpMax
    && x.missileClaim?.hpAfter === x.missileClaim?.hpBefore
    && !x.missileClaim?.receipt,
    JSON.stringify(x.missileClaim));
  report('MAGIC MISSILE: a target who merely WEARS a shield is never asked',
    x.missileNoReaction?.skipped
    || (x.missileNoReaction?.held === false && x.missileNoReaction?.knowsShieldSpell === false),
    JSON.stringify(x.missileNoReaction));
}
if (x.critSkipsHold?.rolled) {
  report('a natural 20 skips the AC-type hold',
    x.critSkipsHold.held === false && x.critSkipsHold.damageRolled === true,
    JSON.stringify(x.critSkipsHold));
} else {
  console.log('  SKIP no natural 20 in 60 attempts — crit path not exercised this run');
}
if (want('7')) {
  const t = x.turnClears;
  // ⚠ The SET's combat gate. Out of combat there is no turn to refresh the flag, so setting it
  // would strand the actor with reactions permanently "spent" and silently suppress every later
  // hold — including the next one somebody sits down to test.
  report('OUT of combat, a reaction does NOT set reactionSpent (the stranding guard)',
    t?.outOfCombatSet === false, `set=${t?.outOfCombatSet}`);
  report('IN a running combat, the same reaction DOES set it',
    t?.inCombatSet === true, `set=${t?.inCombatSet} (startedOnGren=${t?.startedOnGren})`);
  // updateCombat — the first of the two hooks the battery had never dispatched.
  report("updateCombat: the actor's own turn comes round and the flag clears",
    t?.turnReached === true && t?.clearedOnTurn === true,
    `reached=${t?.turnReached} cleared=${t?.clearedOnTurn}`);
  // deleteCombat — the second, and asserted with the feature toggle OFF on purpose: the clears
  // are deliberately not gated on it, because killing the hold mid-combat used to strand every
  // flag already set, and re-enabling it later silently suppressed those actors' first holds.
  report('deleteCombat: the fight ends and the flag clears EVEN WITH reactionHold OFF',
    t?.setBeforeDelete === true && t?.clearedOnDelete === true,
    `setBefore=${t?.setBeforeDelete} clearedAfter=${t?.clearedOnDelete}`);
}
if (r.log?.length) console.log(`\n[hold] discarded rolls: ${r.log.length}`);
if (failures && x.diag) console.log(`\n[hold] diagnostics:\n${JSON.stringify(x.diag, null, 2)}`);

// ⚠ The summary strings stay verbatim: "ALL PASS" and "N FAILURE(S)" are what the handoff,
// the notes and two undiagnosed flake reports all quote. A partial run is stamped instead.
const partial = plan ? `  ⚠ PARTIAL RUN — sections ${plan.join(', ')} only` : '';
for (const id of Object.keys(SECTIONS)) {
  if (plan && !plan.includes(String(id))) console.log(`  SKIP §${id} ${SECTIONS[id]}`);
}
console.log(failures ? `\n[hold] ${failures} FAILURE(S)${partial}` : `\n[hold] ALL PASS${partial}`);
await f.disconnect?.();
process.exit(failures ? 1 : 0);
