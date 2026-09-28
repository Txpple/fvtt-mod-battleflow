// Reaction-hold smoke suite: drives the hold end to end with Gren's own Shield against real
// attacks. The hold pauses the APPLICATION, never the dice: a held hit rolls damage at once,
// born attackHoldPending; a cast re-tests AC and a miss releases with nothing applied; a pass
// releases and applies; a crit skips the hold; a spent reaction suppresses it.
// Restores settings, its chat, and Gren's HP, AC and slots. Setup and teardown always run.
//
// ⚠ The page half COLLECTS and the Node half ASSERTS, so each `report()` sits under the same
// `want()` as the block that fills it — else a skipped section reports FAIL on `undefined`.
// §2 (the cast answers the hold) is written inside §1's block, reading the hold §1 stamped.
import { announcePlan, connectSuite, sectionPlan } from './harness.mjs';

// The coverage map (tools/coverage-map.mjs) parses this; ⚠ never import a suite (it connects on evaluation).
export const COVERS = [
  'hold/index.js',          // the whole reaction hold — every part, §1 to §9
  'hold/lookup.js',
  'hold/clock.js',
  'hold/trigger.js',
  'hold/spell-hold.js',
  'hold/answer.js',
  'hold/continue.js',
  'hold/spell-damage.js',
  'hold/views.js'
];

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
  // Creates a real Combat (deleted in a `finally`) so updateCombat/deleteCombat run under test.
  7:'the PER-TURN CLEARS: reactionSpent set only in combat, cleared on turn and on delete',
  8: 'a TEXT-ONLY feature in the Interrupt list (the 2024 Uncanny Dodge) is found BY NAME and holds as a damage kind',
  // The platform MARKS an expired barrier instead of deleting it; the offer gate must not read
  // that suppressed leftover as Shield still standing.
  9:'the STALE SHIELD: the barrier is clocked to the SHIELDER\'s next turn, tidied when it expires, and the next hit holds again'
};
// Every scenario stamps and restores its own; §4b and §4c both assert `results.realCast`.
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const want = id => !plan || plan.includes(String(id));
// Long watchdog: three sections hunt for an attack inside a 5-wide AC window.
const f =await connectSuite({ tag: 'hold', watchdogMs: 600_000 });
announcePlan('hold', plan, pulled);

let failures = 0;
const report = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const r = await f.evaluate(async ({ sections }) => {
  const MOD = 'fvtt-mod-battleflow';
  // The spent Reaction is an effect chip.
  const clearReaction = async a => { const ids = (a?.effects ?? []).filter(e => e.getFlag(MOD, 'mastery') === 'reaction').map(e => e.id); if (ids.length) await a.deleteEmbeddedDocuments('ActiveEffect', ids).catch(() => {}); };
  // A deliberate mark with NO clock — it stands until deleted (out of combat the module writes none).
  const spendReactionOf = async a => { await a.createEmbeddedDocuments('ActiveEffect', [{ name: 'Reaction — used', img: 'icons/svg/clockwork.svg', transfer: false, flags: { [MOD]: { mastery: 'reaction' } } }]); };
  const reactionSpentOf = async a => { const { reactionSpent } = await import('/modules/fvtt-mod-battleflow/scripts/shared.js'); return reactionSpent(a); };
  // The page-side section gate; the plan arrives as data.
  const want = id => !sections || sections.includes(String(id));
  const log = [];
  const results = {};
  let restore = null;

  // Out here so `finally` can sweep the statblock fixture even when a section throws.
  const CAST_FEATURE = 'BF Test Spellcasting';
  const SHIELD_UUID = 'Compendium.dnd-players-handbook.spells.Item.phbsplShield0000';

  /**
   * Take the statblock fixture (and every spell) back off BF Test Victim; §4d asserts it owns no Shield spell.
   * ⚠ ONE batch delete: a synthetic actor rebuilds its items from the delta on every write, so a
   * loop of `item.delete()` hits documents already dropped.
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
    // ---- setup
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
        interruptList: game.settings.get(MOD, 'interruptList'),
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
    // §6's second trigger is the code table (BLOCKS: Magic Missile against Shield); no list to pin.
    await game.settings.set(MOD, 'holdSettle', 6);
    await game.settings.set(MOD, 'holdApplyEffect', true);
    // ⚠ Reveal OFF: the futility skip follows it (hold/trigger.js holdWouldMatter) and the classic
    // sections assume every hit holds; with it on, a hit 5+ over AC is skipped as hopeless. §4f owns it.
    await game.settings.set(MOD, 'holdReveal', false);
    await game.settings.set(MOD, 'holdTimer', 0);
    await game.settings.set(MOD, 'requireTarget', false);
    // ⚠ Pinned ON: Shield is itself a utility-with-effects cast, and castApplyQualifies'
    // affects-self gate must keep it from stacking a second +5 on the reaction's own application.
    await game.settings.set(MOD, 'castApply', true);
    // Mastery riders and volleys are always on: the weapon's mastery is stripped below (restored in
    // `finally`), and §6 fires Magic Missile's volley itself.

    // Clean fixture first: a leftover cached Shield on BF Test Victim fails §4d for no module reason.
    {
      const victimBase = game.actors.getName('BF Test Victim');
      const victimTok = victimBase ? scene.tokens.find(t => t.actorId === victimBase.id) : null;
      if (victimTok?.actor) {
        const swept = await sweepCastFixture(victimTok.actor);
        if (swept) log.push(`swept ${swept} leftover fixture item(s) off BF Test Victim`);
      }
    }

    // ⚠ Gren's AC stays on its normal calculation: a flat AC ignores ac.bonus, the field
    // Shield's effect writes, so the +5 could never appear.
    // ⚠ The module refuses a GM answering for a character a logged-in player owns, so the
    // real-cast path runs on a GM-owned stand-in; the flag-write path still covers Gren.
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
    // ⚠ Mastery riders are always on: a Graze blade pays its ability mod on every windowed miss (the
    // HP guards) and an optional mastery's ask popup rides the attack card. The blade goes BARE for
    // the run; `finally` puts it back.
    restore.weaponMastery = { id: weapon.id, mastery: weapon.system._source.mastery ?? '' };
    if (restore.weaponMastery.mastery) await weapon.update({ 'system.mastery': '' });

    const attackGren = async (opts = {}) => {
      grenTokenObj.setTarget(true, { releaseOthers: true });
      const usage = await activity().use({ subsequentActions: false }, { configure: false }, {});
      const usageId = usage?.message?.id;
      const rolls = await activity().rollAttack(
        opts, { configure: false }, { data: { 'system.origin': usageId } });
      const msg = rolls?.[0]?.parent;
      return { usageId, msg, total: rolls?.[0]?.total, crit: rolls?.[0]?.isCritical,
        fumble: rolls?.[0]?.isFumble };
    };

    // A plain hit: no crit (it skips an AC hold) and no fumble. `window` demands a total in
    // [AC, AC+4], where Shield's +5 flips the outcome.
    // ⚠ `live` measures against Gren's AC at roll time: under §4a2's standing Shield a hit by
    // the captured `baseAC` is a miss to the module, and the assert flakes.
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
    // ⚠ Search the WHOLE log: the origin id is unique, and a tail window loses real damage cards
    // behind late stray-hold announcements.
    const damageFor = usageId => game.messages.contents.find(m =>
      (m.type === 'damage')
      && (m._source.system?.origin === usageId));

    // A held attack's damage in one read: `pending` is the attackHoldPending claim (null on a
    // never-held roll); `applied` is the receipt, the only proof damage landed.
    const dmgStateFor = usageId => {
      const m = damageFor(usageId);
      return { rolled: !!m,
        pending: m ? (m.getFlag(MOD, 'attackHoldPending') ?? null) : null,
        applied: !!m?.getFlag(MOD, 'receipt') };
    };

    // Why a damage assertion failed: live AC and effects show a stray Shield turning a hit into a miss.
    const diagnose = (usageId, total) => ({
      existsAnywhere: !!game.messages.contents.find(m =>
        (m.type === 'damage')
        && (m._source.system?.origin === usageId)),
      attackTotal: total ?? null,
      grenLiveAC: gren.system.attributes.ac.value,
      grenBaseAC: baseAC,
      grenHP: gren.system.attributes.hp.value,
      grenEffects: gren.effects.map(e => `${e.name}/disabled=${e.disabled}`),
      messagesSinceUsage: game.messages.contents.length
        - game.messages.contents.findIndex(m => m.id === usageId),
    });

    /**
     * A GM-owned full clone of Gren, so the Shield cast is a real spell with real slots.
     * ⚠ Not Shield on the test NPC: an item added to a base actor reaches an unlinked token's
     * delta stripped of effects and activities, and an NPC's spell1.max derives to 0.
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
      // ⚠ Reset HP too: at 0 HP "took no damage" and "took the lot" read the same.
      await actor.update({
        'system.spells.spell1.value': actor.system.spells.spell1.max || 4,
        'system.attributes.hp.value': actor.system.attributes.hp.max,
        'system.attributes.hp.temp': 0,
        // dnd5e 6.0: a forced AC is `override`, and a crashed run can leave one standing.
        'system.attributes.ac.override': null,
      });
      await clearReaction(actor);
      for (const e of actor.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
      // ⚠ Delete stray PENDING holds too: one real cast answers every pending hold for its
      // target (§4b2), and the strays' continuations would apply real damage mid-section.
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
     * A 2024-statblock caster as the Monster Manual ships one: a FEATURE with a `cast` activity
     * carrying the activation, uses and consumption. The actor's Shield item is only the system's
     * cached clone (spellSlot:true, no uses), so it must never be read as the monster's resource.
     * ⚠ Built on the TOKEN actor: an item added to the base reaches the delta stripped of activities.
     * ⚠ Never create the cached spell by hand: the system materializes it itself, and a manual
     * create races that into two Shields. Never force `activation.override` either.
     * `atWill` is the Green Hag shape: `uses.max: ""` and no consumption target means AT-WILL.
     */
    const ensureCastStatblock = async ({ atWill = false, flatAC = false } = {}) => {
      const base = game.actors.getName('BF Test Victim');
      const tokDoc = base ? scene.tokens.find(t => t.actorId === base.id) : null;
      if (!tokDoc) throw new Error('BF Test Victim has no token — run smoke-battleflow.mjs first');
      const actor = tokDoc.actor;      // unlinked: the thing attacked is the synthetic actor

      // Rebuild from scratch: a merge would keep a "1" where the at-will variant wants `max: ""`.
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

      // ⚠ A flat AC ignores ac.bonus, the field Shield writes. `natural` (most statblocks) must
      // work end to end; `flatAC` is the broken statblock, where the module must SAY SO.
      await base.update(flatAC
        ? { 'system.attributes.ac.override': 13 }
        // dnd5e 6.0: natural armour is the `natural` calc over `flat`; a fixed number is `override`.
        :{ 'system.attributes.ac.calcs': ['natural'], 'system.attributes.ac.flat': 13, 'system.attributes.ac.override': null });
      await clearReaction(actor);
      await clearBarriers(actor);

      if (cast.activation?.type !== 'reaction') throw new Error(
        `the cast activity reads activation "${cast.activation?.type}" — the cached spell did not land`);
      return { actor, token: canvas.tokens.get(tokDoc.id), feature, castId: cast.id, base };
    };

    // Attack until one lands in [ac, ac+4], skipping crits and fumbles; `getActivity` is the attacker's.
    const attackIntoFlipWindow = async (getActivity, tokenObj, ac, tries = 40) => {
      for (let i = 0; i < tries; i++) {
        tokenObj.setTarget(true, { releaseOthers: true });
        const usage = await getActivity().use({ subsequentActions: false }, { configure: false }, {});
        const rolls = await getActivity().rollAttack({ advantage: true }, { configure: false },
          { data: { 'system.origin': usage?.message?.id } });
        const t = rolls?.[0];
        if (t && !t.isCritical && !t.isFumble && (t.total >= ac) && (t.total < ac + 5)) {
          return { usageId: usage?.message?.id, msg: t.parent, total: t.total };
        }
        await sleep(100);
      }
      return null;
    };

    // Drive the popup's OWN Cast control (the only path using the hold's recorded itemId/activityId),
    // found through the module's livePopups registry, never by scraping dialog text.
    const { livePopups: LP } = await import('/modules/fvtt-mod-battleflow/scripts/ui.js');
    // ⚠ Only a UUID sub is the hold's (views.js keys it on the target): the volley popup
    // (`<id>|volley`) shares the card's prefix and has no Cast button.
    const holdPopupFor = messageId => {
      for (const [k, d] of LP.entries()) {
        if (k === messageId) return d;
        if (k.startsWith(`${messageId}|`) && k.slice(messageId.length + 1).includes('.')) return d;
      }
      return null;
    };
    const popupButtons = messageId => {
      const el = holdPopupFor(messageId)?.element;
      return el ? [...el.querySelectorAll('footer button, .form-footer button')] : [];
    };
    // The button reads "Cast Shield"; the shape assertions normalize it to "Cast".
    const castButtonFor = messageId => popupButtons(messageId)
      .find(b => b.textContent.trim().startsWith('Cast'));
    const buttonShapeOf = messageId => [...new Set(popupButtons(messageId)
      .map(b => b.textContent.trim()).map(t => t.startsWith('Cast') ? 'Cast' : t))].join('/');

    /**
     * How the module DESCRIBED a resolved hold, as one token; the wording is computed apart from the verdict.
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

    // ---- 1. the hold fires; the damage rolls while it is pending, claimed and unapplied
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

      // ---- 2. CAST answers it; live AC re-test turns the hit into a miss
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
      // Resolution releases the claim; the miss drops Gren from hitTargets, so nothing applies.
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
      await clearReaction(gren);
    }

    // ---- 3. PASS lets the attack through: the released dice APPLY (the receipt is the proof)
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
      await clearReaction(gren);
    }

    // ---- 4. reaction already spent ⇒ no hold at all
    if (want('4')) {
      await spendReactionOf(gren);
      const { usageId, msg, total } = await plainHitOnGren();
      await sleep(2500);
      results.spentSuppresses = {
        held: !!game.messages.get(msg.id)?.getFlag(MOD, 'hold'),
        damageRolled: !!damageFor(usageId),
        why: diagnose(usageId, total),
      };
      await clearReaction(gren);
    }

    // ---- 4a2. an AC reaction ALREADY STANDING ⇒ no hold; independent of reactionSpent (out of combat)
    if (want('4a2')) {
      await clearReaction(gren);
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
      // LIVE AC: the standing Shield just moved it +5.
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
      await clearReaction(gren);
    }

    // ---- 4b. THE REAL CAST PATH on a GM-answerable stand-in: cast → effect → AC moves → re-test
    if (want('4b')) {
      const { actor: victimActor, token: victimTokenObj } = await ensureShielder();
      const vAC = victimActor.system.attributes.ac.value;

      let atk = null;
      for (let i = 0; i < 40 && !atk; i++) {
        victimTokenObj.setTarget(true, { releaseOthers: true });
        const usage = await activity().use({ subsequentActions: false }, { configure: false }, {});
        const rolls = await activity().rollAttack({ advantage: true }, { configure: false },
          { data: { 'system.origin': usage?.message?.id } });
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

      // Click the real Cast control: only that catches a button that answers without casting.
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
        // The reaction's effect leaves one receipt, on the OLDEST pending hold the cast answered
        // (not necessarily this section's attack), so find it wherever it landed.
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
      await clearReaction(victimActor);
    }

    // ---- 4b2. ONE casting answers MANY holds and lands exactly ONE effect (RAW one Shield
    // covers both hits; concurrent per-hold work would stack +10)
    if (want('4b2')) {
      const { actor: victimActor, token: victimTokenObj } = await ensureShielder();
      const vAC = victimActor.system.attributes.ac.value;
      const slotsBefore = victimActor.system.spells.spell1.value;

      // Two attacks that both hit, at any margin.
      const held = [];
      for (let i = 0; i < 40 && held.length < 2; i++) {
        victimTokenObj.setTarget(true, { releaseOthers: true });
        const usage = await activity().use({ subsequentActions: false }, { configure: false }, {});
        const rolls = await activity().rollAttack({ advantage: true }, { configure: false },
          { data: { 'system.origin': usage?.message?.id } });
        const t = rolls?.[0];
        if (!t || t.isCritical || t.isFumble || (t.total < vAC)) { await sleep(100); continue; }
        const msg = t.parent;
        const ok = await waitFor(() =>
          game.messages.get(msg.id)?.getFlag(MOD, 'hold')?.status === 'pending', 6000)
          .catch(() => null);
        if (ok) held.push(msg.id);
      }
      if (held.length < 2) throw new Error(`only ${held.length} hold(s) stamped; need 2`);

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
        secondAnswered: game.messages.get(held[1])?.getFlag(MOD, 'hold')?.targets?.[0]?.answer ?? null,
      };
      for (const e of victimActor.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
      await clearReaction(victimActor);
    }

    // ---- 4c. THE SAFETY NET: a "cast" answer with no effect applied; the continuing client
    // must land the effect itself and reach a miss
    if (want('4c')) {
      const { actor: victimActor, token: victimTokenObj } = await ensureShielder();
      const vAC = victimActor.system.attributes.ac.value;

      let atk = null;
      for (let i = 0; i < 40 && !atk; i++) {
        victimTokenObj.setTarget(true, { releaseOthers: true });
        const usage = await activity().use({ subsequentActions: false }, { configure: false }, {});
        const rolls = await activity().rollAttack({ advantage: true }, { configure: false },
          { data: { 'system.origin': usage?.message?.id } });
        const t = rolls?.[0];
        if (t && !t.isCritical && !t.isFumble && (t.total >= vAC) && (t.total < vAC + 5)) {
          atk = { usageId: usage?.message?.id, msg: t.parent, total: t.total };
        } else await sleep(100);
      }
      if (!atk) throw new Error(`no attack landed in [${vAC}, ${vAC + 4}] for the safety-net test`);
      await waitFor(() => game.messages.get(atk.msg.id)?.getFlag(MOD, 'hold')?.status === 'pending');

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
      await clearReaction(victimActor);
    }

    // ---- 4d. A NAME MATCH IS NOT A REACTION: a worn `equipment` "Shield" must never hold
    if (want('4d')) {
      const victimBase = game.actors.getName('BF Test Victim');
      const vTokDoc = victimBase ? scene.tokens.find(t => t.actorId === victimBase.id) : null;
      if (!vTokDoc) throw new Error('BF Test Victim has no token — run smoke-battleflow.mjs first');
      const vActor = vTokDoc.actor;   // unlinked: the thing attacked is the synthetic actor

      // Idempotent, on the TOKEN actor.
      let mundane = vActor.items.find(i => i.name === 'Shield' && i.type !== 'spell');
      if (!mundane) {
        [mundane] = await vActor.createEmbeddedDocuments('Item',
          [{ name: 'Shield', type: 'equipment', system: { type: { value: 'shield' } } }]);
      }
      await victimBase.update({
        'system.attributes.ac.override': 1 });

      canvas.tokens.get(vTokDoc.id).setTarget(true, { releaseOthers: true });
      const usage = await activity().use({ subsequentActions: false }, { configure: false }, {});
      const usageId = usage?.message?.id;
      const rolls = await activity().rollAttack({ advantage: true }, { configure: false },
        { data: { 'system.origin': usageId } });
      await sleep(2500);
      results.mundaneShield = {
        itemType: mundane.type,
        itemActivation: mundane.system?.activation?.type ?? null,
        // A real Shield SPELL on the fixture would make the test prove nothing.
        strayShieldSpell: vActor.items.some(i => (i.name === 'Shield') && (i.type === 'spell')),
        held: !!game.messages.get(rolls?.[0]?.parent?.id)?.getFlag(MOD, 'hold'),
        damageRolled: !!damageFor(usageId),
        attackTotal: rolls?.[0]?.total,
      };
    }

    // ---- 4d2. THE MONSTER PATTERN: a spell paid for by x/x uses, with no slots. NPC slots sit
    // at 0/0 and every levelled spell on a 2024 NPC reads prepared: 0; neither may block the hold.
    if (want('4d2')) {
      const victimBase = game.actors.getName('BF Test Victim');
      const vTokDoc = scene.tokens.find(t => t.actorId === victimBase.id);
      const vActor = vTokDoc.actor;    // unlinked: build on the TOKEN actor or lose the pieces
      const grenShield = gren.items.find(i => i.name === 'Shield' && i.type === 'spell');

      // Shield as a statblock stores it: one use, no slots.
      const data = grenShield.toObject();
      delete data._id;
      data.system.uses = { max: '1', spent: 0, recovery: [] };
      data.system.prepared = 0;        // as a 2024 NPC statblock actually stores it
      const [npcShield] = await vActor.createEmbeddedDocuments('Item', [data]);
      await victimBase.update({
        'system.attributes.ac.override': 10 });
      await clearReaction(vActor);

      const slots = Object.entries(vActor.system.spells ?? {})
        .filter(([k]) => /^spell[1-9]$/.test(k))
        .map(([k, v]) => `${k}:${v?.value ?? 0}/${v?.max ?? 0}`);

      let atk = null;
      for (let i = 0; i < 30 && !atk; i++) {
        canvas.tokens.get(vTokDoc.id).setTarget(true, { releaseOthers: true });
        const usage = await activity().use({ subsequentActions: false }, { configure: false }, {});
        const rolls = await activity().rollAttack({ advantage: true }, { configure: false },
          { data: { 'system.origin': usage?.message?.id } });
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

      // Answer it so nothing is left pending.
      if (held) {
        const doc = game.messages.get(atk.msg.id);
        const m = foundry.utils.deepClone(doc.getFlag(MOD, 'hold'));
        m.targets.forEach(t => { t.answer = t.answer ?? 'pass'; });
        await doc.setFlag(MOD, 'hold', m);
        await sleep(800);
      }
      await npcShield.delete();
      await clearReaction(vActor);
    }

    // ---- 4d3. THE STATBLOCK CAST-ACTIVITY PATH, END TO END: hold → recorded ids → the real
    // Cast control → the activity's own use spent → the linked spell's effect → the verdict
    if (want('4d3')) {
      const { actor: npc, token: npcToken, feature, castId } = await ensureCastStatblock();
      const vAC = npc.system.attributes.ac.value;
      const slotsBefore = JSON.stringify(npc.system.spells ?? {});
      // ⚠ Capture the NUMBER: a synthetic actor re-instantiates its activities on each prep, so a
      // held reference compares against itself.
      const spentBefore = npc.items.get(feature.id).system.activities.get(castId).uses?.spent ?? 0;

      const atk = await attackIntoFlipWindow(activity, npcToken, vAC);
      if (!atk) throw new Error(`no attack landed in [${vAC}, ${vAC + 4}] against the statblock caster`);

      const pending = await waitFor(() => {
        const h = game.messages.get(atk.msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'pending' ? h : null;
      });
      const heldTarget = pending?.targets?.[0] ?? null;

      // Exactly two controls, the same two a player gets (deduped: the DOM repeats them).
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

      // ⚠ The wording is computed apart from the verdict, by a NAME lookup on an actor owning two
      // items called Shield, so a correct hold can still announce "not applied".
      const announced = announcementFor(heldTarget?.name);

      results.statblockCast = {
        announced,
        buttonShape,
        pending: !!pending,
        reaction: heldTarget?.reaction ?? null,
        // ⚠ The ids, not the name: a name lookup finds the worn shield or the cached spell.
        itemIdOK: heldTarget?.itemId === feature.id,
        activityIdOK: heldTarget?.activityId === castId,
        recorded: `${heldTarget?.itemId ?? null}/${heldTarget?.activityId ?? null}`,
        expected: `${feature.id}/${castId}`,
        answered: done?.targets?.[0]?.answer ?? null,
        verdict: done?.targets?.[0]?.verdict ?? null,
        acBefore: vAC,
        acAfter: npc.system.attributes.ac.value,
        effectApplied: !!npc.effects.find(e => e.name === 'Imperceptible Barrier' && !e.disabled),
        // The activity's own pool pays; no slot moves.
        usesSpent: (spentAfter === null) ? null : spentAfter - spentBefore,
        usesLabel: `spent ${spentBefore} → ${spentAfter} of ${after?.max ?? '?'}`,
        slotsUnchanged: JSON.stringify(npc.system.spells ?? {}) === slotsBefore,
        dmg: dmgStateFor(atk.usageId),
        attackTotal: atk.total,
      };
      await clearBarriers(npc);
      await clearReaction(npc);
    }

    // ---- 4d4. THE AT-WILL VARIANT: on a cast activity an empty `uses` means at will, not spent
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

      // Answer it so nothing is left pending.
      if (held) {
        const doc = game.messages.get(atk.msg.id);
        const m = foundry.utils.deepClone(doc.getFlag(MOD, 'hold'));
        m.targets.forEach(t => { t.answer = t.answer ?? 'pass'; });
        await doc.setFlag(MOD, 'hold', m);
        await sleep(800);
      }
      await clearReaction(npc);
    }

    // ---- 4d5. A PC ATTACKS A MONSTER THAT HOLDS A REACTION: the mode gate, stamp, answer, verdict
    // ⚠ Not covered: BEING a player's client. continueHold's effect safety net is
    // `actor.isOwner`-gated, always true for the GM harness, a no-op for a real player here.
    if (want('4d5')) {
      const pcAttacker = game.actors.getName('BF Test PC Attacker');
      if (!pcAttacker) throw new Error('BF Test PC Attacker missing — run smoke-battleflow.mjs first');
      const pcWeapon = pcAttacker.items.find(i => i.system.activities?.some?.(a => a.type === 'attack'));
      if (!pcWeapon) throw new Error('BF Test PC Attacker has no attack activity');
      const pcActivity = () => game.actors.getName('BF Test PC Attacker')
        .items.get(pcWeapon.id).system.activities.find(a => a.type === 'attack');

      const { actor: npc, token: npcToken } = await ensureCastStatblock();
      const vAC = npc.system.attributes.ac.value;

      // The PC's attack holds on the monster's reaction and answers for real.
      npcToken.setTarget(true, { releaseOthers: true });
      await clearReaction(npc);
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
      await clearReaction(npc);
      await sweepCastFixture(npc);
    }

    // ---- 4d6. A FLAT AC CANNOT RECEIVE THE REACTION, AND THE CARD MUST SAY SO. dnd5e's
    // prepareArmorClass returns on the flat branch before ac.bonus is added, so the effect lands
    // and the number never moves; the card must name the fixed AC, not "not arrived".
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
      await clearReaction(npc);
      await sweepCastFixture(npc);
    }

    // ---- 4e. THE TIMER: an unanswered hold passes itself
    if (want('4e')) {
      await game.settings.set(MOD, 'holdTimer', 4);
      const { usageId, msg } = await plainHitOnGren({ window: true });
      const pending = await waitFor(() => {
        const h = game.messages.get(msg.id)?.getFlag(MOD, 'hold');
        return h?.status === 'pending' ? h : null;
      });
      // Answer nothing: the continuing client's buzzer must pass it; the deadline rides the flag.
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
      await clearReaction(gren);
    }

    // ---- 4f. HOPELESS HOLDS ARE SKIPPED, only under full disclosure: with the math hidden, a
    // missing prompt would itself leak the margin
    if (want('4f')) {
      await game.settings.set(MOD, 'holdReveal', true);
      // Shield adds +5, so AC+5 or more is hopeless.
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

      // With the math hidden it must still hold.
      await game.settings.set(MOD, 'holdReveal', false);
      await clearReaction(gren);
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
        if (held) {
          const doc = game.messages.get(hidden.msg.id);
          const m = foundry.utils.deepClone(doc.getFlag(MOD, 'hold'));
          m.targets.forEach(t => { t.answer = t.answer ?? 'pass'; });
          await doc.setFlag(MOD, 'hold', m);
        }
      }
      await game.settings.set(MOD, 'holdReveal', false);
      await clearReaction(gren);
    }

    // ---- 5. a natural 20 skips an AC-type hold
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
      await clearReaction(gren);
    }

    // ---- 6. THE SECOND TRIGGER: Magic Missile has no attack roll, so a spell USAGE stamps a
    // `negate` hold on its usage card and the answer alone is the verdict.
    // ⚠ The load-bearing assert is the last: real damage applied as the native tray applies it,
    // and the shielded HP must not move.
    if (want('6')) {
      const MM_UUID = 'Compendium.dnd-players-handbook.spells.Item.phbsplMagicMissi';

      // ⚠ No slot cost: NPC slot maxima derive to 0, so a slot-consuming cast is refused.
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

      const castMissileAt = async tokenObj => {
        tokenObj.setTarget(true, { releaseOthers: true });
        const usage = await missile().use({ subsequentActions: false }, { configure: false }, {});
        return usage?.message ?? null;
      };

      // ⚠ THE VOLLEY IS ALWAYS ON: Magic Missile is a volley, so the use opens the aim popup beside the
      // hold popup (both keyed on the usage card) and the darts are the volley's to roll — the native
      // follow-up is switched off. Fire it FIRST, while the hold is still pending: the driven dart roll
      // is born claimed (spellDamage + spellHoldPending, polish.js), so the answer decides it.
      const volleyPopupFor = usageId => LP.get(`${usageId}|volley`) ?? null;
      const fireVolleyOn = async usageMsg => {
        const dlg = await waitFor(() => volleyPopupFor(usageMsg.id)?.element ? volleyPopupFor(usageMsg.id) : null, 8000);
        if (!dlg) throw new Error('Magic Missile opened no volley popup to fire');
        const fire = dlg.element.querySelector('button[data-action="fire"]');
        if (!fire) throw new Error('the volley popup rendered no Fire button');
        fire.click();
        const dart = await waitFor(() => game.messages.contents.find(m =>
          (m.type === 'damage') && (m.getFlag(MOD, 'volleyFor') === usageMsg.id)) ?? null, 12000);
        if (!dart) throw new Error('the fired volley rolled no dart damage');
        return dart;
      };
      // A section that only needs the card: stand the volley down WITHOUT driving darts (fireVolley
      // acts on a pending flag only, and the popup's X routes through it).
      const standDownVolley = async usageMsg => {
        const v = usageMsg?.getFlag(MOD, 'volley');
        if (v?.status === 'pending') {
          await usageMsg.setFlag(MOD, 'volley', { ...v, status: 'resolved', assignment: [], resolvedAt: Date.now() });
        }
        await volleyPopupFor(usageMsg?.id)?.close?.();
      };

      const partsOf = damageMsg => dnd5e.dice.aggregateDamageRolls(damageMsg.rolls, { respectProperties: true })
        .map(r => ({
          value: Math.max(0, r.total), type: r.options.type,
          properties: new Set(r.options.properties ?? []),
        }));

      // The dart roll's fate. expectApply waits for the receipt; otherwise give a wrong auto-apply
      // every chance, then make the native tray's exact applyDamage call, which the veto must survive.
      // `hpBefore` is read BEFORE the answer: the claim defers the applier until then.
      const awaitDartFate = async (damageMsg, actor, hpBefore, { expectApply }) => {
        const damages = partsOf(damageMsg);
        const rolled = damages.reduce((sum, d) => sum + d.value, 0);
        if (expectApply) {
          await waitFor(() => game.messages.get(damageMsg.id)?.getFlag(MOD, 'receipt') ?? null, 15000);
        } else {
          await sleep(3000);
          await actor.applyDamage(damages, {
            multiplier: 1, isDelta: true, originatingMessage: damageMsg, origin: damageMsg,
          });
        }
        // hpMax proves the target was whole; effectiveMax, since a tempmax debuff makes max unreachable.
        return {
          rolled, hpBefore, hpAfter: actor.system.attributes.hp.value,
          hpMax: actor.system.attributes.hp.effectiveMax ?? actor.system.attributes.hp.max,
        };
      };

      await ensureMissile();

      // -- 6a/6b/6c: cast Shield → the spell is negated and its damage never lands
      {
        const { actor: shielder, token: shielderToken } = await ensureShielder();
        const usageMsg = await castMissileAt(shielderToken);
        if (!usageMsg) throw new Error('Magic Missile created no usage card to hold');

        const pending = await waitFor(() => {
          const h = game.messages.get(usageMsg.id)?.getFlag(MOD, 'hold');
          return h?.status === 'pending' ? h : null;
        });
        const dart = await fireVolleyOn(usageMsg);
        const hpBefore = shielder.system.attributes.hp.value;

        // The same Cast/Pass pair an attack hold offers.
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

        const applied = await awaitDartFate(dart, shielder, hpBefore, { expectApply: false });
        results.missileNegated = {
          pending: !!pending,
          trigger: pending?.trigger ?? null,
          spell: pending?.spell ?? null,
          kind: pending?.targets?.[0]?.kind ?? null,
          reaction: pending?.targets?.[0]?.reaction ?? null,
          buttonShape: [...new Set(buttons)].join('/'),
          answered: done?.targets?.[0]?.answer ?? null,
          verdict: done?.targets?.[0]?.verdict ?? null,
          // Shield's +5 arrives too.
          effectApplied: !!shielder.effects.find(e =>
            e.name === 'Imperceptible Barrier' && !e.disabled),
          ...applied,
          // Assert what the table is TOLD, too.
          announced: game.messages.contents.slice(-12).some(m =>
            m.speaker?.alias === 'Battle Flow' && /does nothing to/i.test(m.content ?? '')),
        };
        for (const e of shielder.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
        await clearReaction(shielder);
      }

      // -- 6d: pass → the missiles land in full
      {
        const { actor: shielder, token: shielderToken } = await ensureShielder();
        const usageMsg = await castMissileAt(shielderToken);
        const pending = await waitFor(() => {
          const h = game.messages.get(usageMsg.id)?.getFlag(MOD, 'hold');
          return h?.status === 'pending' ? h : null;
        });
        const dart = await fireVolleyOn(usageMsg);
        const hpBefore = shielder.system.attributes.hp.value;
        const passButton = await waitFor(() => popupButtons(usageMsg.id)
          .find(b => b.textContent.trim() === 'Pass'), 8000);
        if (!passButton) throw new Error('the spell hold popup rendered no Pass button');
        passButton.click();

        const done = await waitFor(() => {
          const h = game.messages.get(usageMsg.id)?.getFlag(MOD, 'hold');
          return h?.status === 'resolved' ? h : null;
        }, 25000);
        await sleep(800);

        const applied = await awaitDartFate(dart, shielder, hpBefore, { expectApply: true });
        results.missilePassed = {
          pending: !!pending,
          answered: done?.targets?.[0]?.answer ?? null,
          verdict: done?.targets?.[0]?.verdict ?? null,
          ...applied,
        };
        await clearReaction(shielder);
      }

      // -- 6f: claim → defer → release on the native card: the dart roll chains to the usage card, the
      //        claim defers the applier while pending, the negate releases with the shielder skipped
      {
        const { actor: shielder, token: shielderToken } = await ensureShielder();
        const before = new Set(game.messages.contents.map(m => m.id));
        shielderToken.setTarget(true, { releaseOthers: true });
        await sleep(120);
        await missile().use({ subsequentActions: false }, { configure: false }, {});
        const freshMsgs = () => game.messages.contents.filter(m => !before.has(m.id));
        const holdMsg = await waitFor(() => freshMsgs().find(m =>
          m.getFlag(MOD, 'hold')?.status === 'pending') ?? null, 10000);
        const heldOnUsage = !!holdMsg && (holdMsg.type === 'usage');
        const hpBefore = shielder.system.attributes.hp.value;
        const damageMsg = holdMsg ? await fireVolleyOn(holdMsg) : null;
        // ⚠ Captured AT THE ROLL: after the answer the flag reads released.
        const pendingAtRoll = damageMsg?.getFlag(MOD, 'spellHoldPending') === true;
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
        await clearReaction(shielder);
      }

      // -- 6e: a target who cannot cast Shield is never asked (the victim only WEARS one)
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
          // The card was the question; no darts at the 11-HP victim.
          await standDownVolley(usageMsg);
        } else {
          results.missileNoReaction = { skipped: true };
        }
      }

      // BF Test Attacker is every other section's weapon attacker: take the spell back off.
      const leftover = attacker.items
        .filter(i => i.name === 'Magic Missile' && i.type === 'spell').map(i => i.id);
      if (leftover.length) await attacker.deleteEmbeddedDocuments('Item', leftover);
    }

    // ---- 8. a text-only feature (the 2024 Uncanny Dodge: no activities) found by name
    if (want('8')) {
      // The Interrupt list is the code table, and it lists Shield (and Absorb Elements) AHEAD of
      // Uncanny Dodge: with no slot left, Gren's spells are unusable and the dodge is the reaction found.
      let dodge = null;
      try {
        const noSlots = {};
        for (const [key, slot] of Object.entries(gren.system.spells ?? {})) {
          if (slot?.max) noSlots[`system.spells.${key}.value`] = 0;
        }
        await gren.update(noSlots);
        [dodge] = await gren.createEmbeddedDocuments('Item', [{
          name: 'Uncanny Dodge', type: 'feat',
          system: { type: { value: 'class' }, description: { value: '<p>When an attacker that you can see hits you with an attack roll, you can take a Reaction to halve the attack’s damage against you (round down).</p>' } }
        }]);
        await clearReaction(gren);
        const { usageId, msg } = await plainHitOnGren();
        const held = await waitFor(() => {
          const h = game.messages.get(msg.id)?.getFlag(MOD, 'hold');
          return h?.status === 'pending' ? h : null;
        }, 8000);
        let resolved = null;
        if (held) {
          const doc = game.messages.get(msg.id);
          const merged = foundry.utils.deepClone(doc.getFlag(MOD, 'hold'));
          merged.targets.find(t => t.uuid === gren.uuid).answer = 'cast';
          await doc.setFlag(MOD, 'hold', merged);
          resolved = await waitFor(() => {
            const h = game.messages.get(msg.id)?.getFlag(MOD, 'hold');
            return h?.status === 'resolved' ? h : null;
          }, 20000);
        }
        const applied = held ? await waitFor(() => damageFor(usageId)?.getFlag(MOD, 'receipt') ?? null, 15000) : null;
        const entry = applied?.targets?.find?.(e => e.uuid === gren.uuid) ?? null;
        results.textOnlyHold = {
          multiplier: entry?.multiplier ?? null, note: entry?.note ?? null,
          activities: dodge?.system?.activities?.size ?? null,
          pending: !!held, reaction: held?.targets?.[0]?.reaction, kind: held?.targets?.[0]?.kind,
          itemIsDodge: held?.targets?.[0]?.itemId === dodge?.id, activityId: held?.targets?.[0]?.activityId ?? null,
          resolved: !!resolved, verdict: resolved?.targets?.[0]?.verdict, applied: !!applied,
        };
      } finally {
        await gren.update({ 'system.spells': restore.grenSlots }).catch(() => {});
        if (dodge) await dodge.delete().catch(() => {});
        await clearReaction(gren);
      }
    }

    // ---- 7. the per-turn clears: the reactionSpent lifecycle (updateCombat, deleteCombat)
    if (want('7')) {
      // ⚠ Two rules: the SET refuses out of combat (no turn would ever refresh it), and the CLEARS
      // are not gated on the feature toggle (turning it off mid-combat must not strand flags).
      let combat = null;
      // The spent Reaction chip: standing and not marked expired.
      const spent = () => reactionSpentOf(game.actors.get(gren.id));
      const shieldActivity = () => gren.items.get(shield.id)?.system.activities?.contents?.[0];
      // ⚠ Consume nothing: Gren is a campaign PC whose slots may be spent, and dnd5e then refuses
      // the use before postUseActivity fires.
      const castShield = async () => {
        await shieldActivity()?.use({ consume: { spellSlot: false, resources: false, action: false }, subsequentActions: false },
          { configure: false }, { create: false });
        await sleep(500);
      };
      try {
        await clearReaction(gren);
        if (game.combat) await game.combat.delete();
        await sleep(300);

        // (a) OUT of combat, the set is REFUSED.
        await castShield();
        const outOfCombat = await spent();

        // (b) IN a running combat, the same reaction DOES set it.
        // ⚠ Two combatants: with one, there is no turn to advance to and (c) is unobservable.
        const foeToken = scene.tokens.find(t => t.actorId === attacker.id)
          ?? scene.tokens.find(t => t.actorId !== gren.id);
        combat = await Combat.create({ scene: scene.id });
        await combat.createEmbeddedDocuments('Combatant', [
          { actorId: gren.id, tokenId: grenToken.id, sceneId: scene.id },
          ...(foeToken ? [{ actorId: foeToken.actorId, tokenId: foeToken.id, sceneId: scene.id }] : [])
        ]);
        await combat.rollAll();
        // Activated: the module reads `game.combat`, the ACTIVE encounter.
        await combat.activate();
        await combat.startCombat();
        await sleep(400);
        // What the module will see; a false here explains a false below.
        const combatSeen = { gameCombatIsOurs: game.combat?.id === combat.id, combatActive: combat.active,
          viewed: canvas.scene?.name ?? null, grenOwner: !!gren.isOwner, grenInTracker: combat.getCombatantsByActor(gren).length };
        // ⚠ Step off Gren first: updateCombat clears the current combatant's flag, so (c) would
        // pass for the wrong reason.
        for (let i = 0; (i < 4) && (combat.combatant?.actor?.id === gren.id); i++) {
          await combat.nextTurn();
          await sleep(250);
        }
        const startedOnGren = combat.combatant?.actor?.id === gren.id;
        await clearReaction(gren);
        await castShield();
        // Wait for the chip (written after the cast resolves); the out-of-combat read asserts absence.
        const inCombat = !!(await waitFor(spent, 6000));

        // (c) `updateCombat`: Gren's own turn comes round and the flag clears.
        let reached = false;
        for (let i = 0; i < 6; i++) {
          await combat.nextTurn();
          await sleep(300);
          if (combat.combatant?.actor?.id === gren.id) { reached = true; break; }
        }
        const clearedOnTurn = reached && !(await spent());

        // (d) `deleteCombat` clears it for every combatant.
        await spendReactionOf(gren);
        await sleep(200);
        const setBeforeDelete = await spent();
        await combat.delete();
        combat = null;
        await sleep(600);
        const clearedOnDelete = !(await spent());

        results.turnClears = {
          outOfCombatSet: outOfCombat, startedOnGren, inCombatSet: inCombat, ...combatSeen,
          turnReached: reached, clearedOnTurn, setBeforeDelete, clearedOnDelete
        };
      } finally {
        // ⚠ A leftover combat poisons later suites (hold and mastery read inRunningCombat).
        try { if (combat) await combat.delete(); } catch { /* already gone */ }
        try { if (game.combat) await game.combat.delete(); } catch { /* ditto */ }
        await clearReaction(gren);
        await clearBarriers(gren);
      }
    }

    // ---- 9. THE STALE SHIELD: attacker first. r1t0 the barrier lands; r1t1 (the shielder's turn
    // start) the platform marks it expired and the module DELETES it; r2t0 the hold offers again.
    if (want('9')) {
      let combat = null;
      const wasMine = [];
      try {
        const { actor: sh, token: shObj } = await ensureShielder();
        const shAC = sh.system.attributes.ac.value;
        let foeTok = scene.tokens.find(t => t.actorId === attacker.id) ?? null;
        if (!foeTok) {
          [foeTok] = await scene.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(
            attacker.prototypeToken.toObject(), { x: 1100, y: 1200, actorId: attacker.id }, { inplace: false })]);
          wasMine.push(foeTok.id);
        }
        if (game.combat) await game.combat.delete();
        combat = await Combat.create({ scene: scene.id, active: true });
        await combat.createEmbeddedDocuments('Combatant', [
          { tokenId: foeTok.id, actorId: attacker.id, initiative: 20 },
          { tokenId: shObj.document.id, actorId: sh.id, initiative: 10 }
        ]);
        await combat.startCombat();
        await sleep(600);
        const at = () => `r${combat.round}t${combat.turn}`;
        const barrier = () => sh.effects.find(e => e.name === 'Imperceptible Barrier') ?? null;
        const shape = () => { const e = barrier(); return e ? { present: true, active: e.active, expired: e.duration?.expired ?? null,
          units: e._source.duration?.units, value: e._source.duration?.value, expiry: e._source.duration?.expiry,
          startCombatant: e._source.start?.combatant ?? null, ac: sh.system.attributes.ac.value } : { present: false, ac: sh.system.attributes.ac.value }; };
        const shielderCombatant = combat.combatants.find(c => c.actorId === sh.id)?.id ?? null;

        const first = await attackIntoFlipWindow(activity, shObj, shAC);
        if (!first) throw new Error(`§9: no attack landed in [${shAC}, ${shAC + 4}]`);
        const pending = await waitFor(() => { const h = game.messages.get(first.msg.id)?.getFlag(MOD, 'hold'); return h?.status === 'pending' ? h : null; });
        const castButton = await waitFor(() => castButtonFor(first.msg.id), 8000);
        if (!castButton) throw new Error('§9: no Cast button');
        castButton.click();
        const resolved = await waitFor(() => { const h = game.messages.get(first.msg.id)?.getFlag(MOD, 'hold'); return h?.status === 'resolved' ? h : null; }, 25000);
        await sleep(1200);
        const landed = { at: at(), pending: !!pending, verdict: resolved?.targets?.[0]?.verdict, ...shape(), shielderCombatant };

        await combat.nextTurn(); await sleep(1500);        // r1t1 — the shielder's own turn start
        const ownTurn = { at: at(), ...shape(), reactionSpent: await reactionSpentOf(sh) };
        await combat.nextTurn(); await sleep(1500);        // r2t0 — the attacker again
        const second = await attackIntoFlipWindow(activity, shObj, shAC);
        if (!second) throw new Error('§9: no second attack in the window');
        const held2 = await waitFor(() => { const h = game.messages.get(second.msg.id)?.getFlag(MOD, 'hold'); return h?.status === 'pending' ? h : null; }, 8000);
        const again = { at: at(), total: second.total, held: !!held2, ...shape() };
        if (held2) {
          const merged = foundry.utils.deepClone(held2); merged.targets.forEach(t => { if (!t.answer) t.answer = 'pass'; });
          await game.messages.get(second.msg.id).setFlag(MOD, 'hold', merged); await sleep(1200);
        }
        results.staleShield = { baseAC: shAC, landed, ownTurn, again };
      } finally {
        try { if (combat) await combat.delete(); } catch { /* gone */ }
        try { if (game.combat) await game.combat.delete(); } catch { /* ditto */ }
        for (const id of wasMine) { try { await scene.tokens.get(id)?.delete(); } catch { /* gone */ } }
        const sh = game.actors.getName('BF Test Shielder');
        if (sh) { await clearReaction(sh); await clearBarriers(sh); }
      }
    }

    return { ok: true, results, log };
  } catch (err) {
    return { ok: false, why: `${err.message}\n${err.stack}`, results, log };
  } finally {
    // ---- always: put the world back
    try {
      const gren = game.actors.getName('Gren Greenmantle');
      if (restore) {
        for (const [k, v] of Object.entries(restore.settings)) await game.settings.set(MOD, k, v);
        await gren?.update({
          'system.attributes.hp.value': restore.grenHP.value,
          'system.attributes.hp.temp': restore.grenHP.temp,
          'system.spells': restore.grenSlots,
        });
        await clearReaction(gren);
        for (const e of gren?.effects?.filter(e => e.name === 'Imperceptible Barrier') ?? []) await e.delete();
        if (restore.weaponMastery?.mastery) {
          await game.actors.getName('BF Test Attacker')?.items.get(restore.weaponMastery.id)
            ?.update({ 'system.mastery': restore.weaponMastery.mastery });
        }
      }
      // Long rest every fixture (never the live PCs): the suite spends real slots and HP.
      for (const name of ['BF Test Shielder', 'BF Test Attacker', 'BF Test Victim', 'BF Test PC Attacker']) {
        const fixture = game.actors.getName(name);
        if (!fixture) continue;
        try {
          await fixture.longRest({ dialog: false, chat: false, newDay: true });
        } catch {
          // longRest is the system's API; fall back to a manual restore.
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
        await clearReaction(fixture);
        for (const e of fixture.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
      }
      // ⚠ Sweep the statblock fixture and §6's Magic Missile here too: a throw skips the
      // in-section teardown, and leftovers fail the next run's §4d.
      const victimBase = game.actors.getName('BF Test Victim');
      const victimToken = victimBase
        ? game.scenes.getName('Battle Flow Test Range')?.tokens.find(t => t.actorId === victimBase.id)
        : null;
      if (victimToken?.actor) await sweepCastFixture(victimToken.actor);

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
  // hadSource/effectUp are part of the assertion: without the effect up, a pass proves nothing.
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
  // ⚠ hpBefore === hpMax is part of the assertion: at 0 HP "lost nothing" proves nothing.
  report('MAGIC MISSILE: real damage is applied and the shielded target loses NOTHING',
    x.missileNegated?.rolled > 0 && x.missileNegated?.hpBefore === x.missileNegated?.hpMax
    && x.missileNegated?.hpAfter === x.missileNegated?.hpBefore,
    `rolled ${x.missileNegated?.rolled}, HP ${x.missileNegated?.hpBefore} → `
    + `${x.missileNegated?.hpAfter} (max ${x.missileNegated?.hpMax})`);
  report('MAGIC MISSILE: the table is told the spell did nothing',
    x.missileNegated?.announced === true,
    `announced: ${x.missileNegated?.announced}`);
  // hpBefore > rolled: HP clamps at 0, which would read as a partial hit.
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
if (want('8')) {
  report('§8 a text-only feature in the Interrupt list is found BY NAME: the hold stamps it as a damage kind with no activity',
    x.textOnlyHold?.activities === 0 && x.textOnlyHold?.pending && x.textOnlyHold?.reaction === 'Uncanny Dodge'
    && x.textOnlyHold?.kind === 'damage' && x.textOnlyHold?.itemIsDodge && x.textOnlyHold?.activityId === null,
    JSON.stringify(x.textOnlyHold));
  report('§8 the cast answer resolves it; the hit stands and the damage lands HALVED, the receipt row saying why',
    x.textOnlyHold?.resolved && x.textOnlyHold?.verdict === 'hit' && x.textOnlyHold?.applied
    && x.textOnlyHold?.multiplier === 0.5 && /Uncanny Dodge/.test(x.textOnlyHold?.note ?? ''),
    JSON.stringify(x.textOnlyHold));
}
if (want('7')) {
  const t = x.turnClears;
  report('OUT of combat, a reaction does NOT set reactionSpent (the stranding guard)',
    t?.outOfCombatSet === false, `set=${t?.outOfCombatSet}`);
  report('IN a running combat, the same reaction DOES set it',
    t?.inCombatSet === true, `set=${t?.inCombatSet} (startedOnGren=${t?.startedOnGren} gameCombatIsOurs=${t?.gameCombatIsOurs} active=${t?.combatActive} viewed=${t?.viewed} owner=${t?.grenOwner} inTracker=${t?.grenInTracker})`);
  report("updateCombat: the actor's own turn comes round and the flag clears",
    t?.turnReached === true && t?.clearedOnTurn === true,
    `reached=${t?.turnReached} cleared=${t?.clearedOnTurn}`);
  report('deleteCombat: the fight ends and the flag clears',
    t?.setBeforeDelete === true && t?.clearedOnDelete === true,
    `setBefore=${t?.setBeforeDelete} clearedAfter=${t?.clearedOnDelete}`);
}
if (want('9')) {
  const s = x.staleShield;
  report('§9 the cast lands the barrier clocked to the SHIELDER: zero turns at the reactor\'s turnStart, start = the shielder\'s combatant, AC +5',
    s?.landed?.pending && s?.landed?.verdict === 'miss' && s?.landed?.present && s?.landed?.active
    && s?.landed?.units === 'turns' && s?.landed?.value === 0 && s?.landed?.expiry === 'turnStart'
    && s?.landed?.startCombatant === s?.landed?.shielderCombatant && s?.landed?.ac === s?.baseAC + 5,
    JSON.stringify(s?.landed));
  report('§9 at the shielder\'s own next turn the barrier is GONE (expired, then tidied) and the AC is back to base — the Reaction back too',
    s?.ownTurn?.present === false && s?.ownTurn?.ac === s?.baseAC && s?.ownTurn?.reactionSpent === false,
    JSON.stringify(s?.ownTurn));
  report('§9 the attacker\'s next swing HOLDS again — nothing dead is read as Shield standing',
    s?.again?.held === true && s?.again?.ac === s?.baseAC,
    JSON.stringify(s?.again));
}
if (r.log?.length) console.log(`\n[hold] discarded rolls: ${r.log.length}`);
if (failures && x.diag) console.log(`\n[hold] diagnostics:\n${JSON.stringify(x.diag, null, 2)}`);

// ⚠ "ALL PASS" and "N FAILURE(S)" stay verbatim: other tools and docs match them.
const partial = plan ? `  ⚠ PARTIAL RUN — sections ${plan.join(', ')} only` : '';
for (const id of Object.keys(SECTIONS)) {
  if (plan && !plan.includes(String(id))) console.log(`  SKIP §${id} ${SECTIONS[id]}`);
}
console.log(failures ? `\n[hold] ${failures} FAILURE(S)${partial}` : `\n[hold] ALL PASS${partial}`);
await f.disconnect?.();
process.exit(failures ? 1 : 0);
