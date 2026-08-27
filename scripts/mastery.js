/**
 * Battle Flow — Phase 1.9B/C: weapon mastery riders, the mastery ask, the topple fold and its popup, and the reminders.
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, queueFlagWrite,
  canAnswerFor, inRunningCombat, combatStamp, statContext } from "./core.js";
import { effectRecord, joinEffectReceipt, takenOf } from "./decide/receipt.js";
import { MASTERY_KINDS, MASTERY_NATIVE } from "./decide/registry.js";
import { hitTargets, modeAllows, rollConfigFor } from "./shared.js";
import { popupKey, bfCard, holdBarHTML, momentBarHTML, ruleLine } from "./decide/present.js";
import { livePopups, openMomentPopup,
  momentButton, scheduleBarSync, shownMoments, acknowledgeMoment, momentAcknowledged,
  armAskTimer, disarmAskTimer, armDeadline, disarmDeadline,
  dramaticVerdictPause } from "./ui.js";
import { forceStatus } from "./shared.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { messageActivity } from "./effect-riders.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 1.9B/C — weapon mastery riders (PLAN.md sections B and C).
 *
 * Detection is one flag read: the system stamps the mastery used onto
 * `flags.dnd5e.roll.mastery` of the attack message (attack.mjs:167), and only when the
 * wielder genuinely has that mastery with that weapon — eligibility, identity and the
 * which-mastery choice are all pre-solved upstream. Masteries are PC-only in data (the
 * trait lives on character actors alone), so the ask always has a natural owner: the
 * attacking player.
 *
 * The payouts, by shape (2024 rules text decides the mode):
 *   Vex, Sap        automatic — the rules give no choice. Authored effects, applied like 1.9A.
 *   Slow            "you can" + requires damage dealt. Authored effect, −10 speed (self-enforcing).
 *   Topple          "you can". A card carrying the native [[/save]] enricher + a GM prone
 *                   button — the save stays MANUAL until Phase 2 upgrades this same card.
 *   Push            "you can". Announce only; tokens are never moved.
 *   Graze           pays on a MISS: flat ability-mod damage through the shared applier, with
 *                   the receipt stamped on the ATTACK card (no damage message exists).
 *   Cleave, Nick    out of scope — action economy stays native.
 *
 * THE FENCE (user call): nothing here ever modifies a d20. Vex/Sap enforcement-and-expiry
 * is the deferred AC5e-sized lift; the chip is the reminder and the roll dialog is the
 * enforcement surface. Durations are the RAW windows approximated to a round — in combat
 * `rounds: 1`, else seconds — refresh, never stack.
 *
 * The ask (1.9C) is a hold miniaturized: the elect stamps a `mastery` flag on the attack
 * message; every client renders a row; the DECIDER's client volunteers a Use/Pass popup
 * (canAnswerFor the attacker — same two controls for everybody); the answer travels as a
 * flag flip; the elect executes. Nothing downstream waits — it is a payout with a confirm,
 * not an interrupt — so there is no continuation, no settle, no re-test. The timer reuses
 * the hold's clock (holdTimer, 0 = wait forever), the elect owns the buzzer, expiry = Pass.
 * ------------------------------------------------------------------------------------------- */

/** Masteries already warned about — once per session, not once per swing. */
const warnedMasteries = new Set();

/** The authored payout effects. Nothing ships these — the system's masteries are labels. */
const MASTERY_EFFECTS = {
  vex: {
    name: "Vexed", img: "icons/svg/target.svg",
    description: attacker => `${attacker.name} has Advantage on their next attack roll against this creature (Vex, before the end of ${attacker.name}'s next turn). Claim it in the roll dialog — nothing applies it for you.`
  },
  sap: {
    name: "Sapped", img: "icons/svg/downgrade.svg",
    description: attacker => `Disadvantage on its next attack roll (Sap, before the start of ${attacker.name}'s next turn). The reminder is this chip; the roll dialog is where it is honoured.`
  },
  slow: {
    name: "Slowed", img: "icons/svg/net.svg",
    description: attacker => `Speed reduced by 10 feet until the start of ${attacker.name}'s next turn (Slow).`,
    changes: () => [
      { key: "system.attributes.movement.walk", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "-10" },
      { key: "system.attributes.movement.fly", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "-10" }
    ]
  }
};

/** Walk-5 (z): what each mastery popup quotes — the 2024 property text VERBATIM, matched
 * against the system's own rules journal by tools/probe-mastery-rules.mjs (2026-08-21,
 * dnd5e 5.3.3; punctuation included). Never paraphrase these; the module's operational
 * hints ride as separate lines wherever they are needed. */
const MASTERY_RULES = {
  slow: "If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn. If the creature is hit more than once by weapons that have this property, the Speed reduction doesn’t exceed 10 feet.",
  topple: "If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 plus the ability modifier used to make the attack roll and your Proficiency Bonus). On a failed save, the creature has the Prone condition.",
  push: "If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller.",
  graze: "If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll. This damage is the same type dealt by the weapon, and the damage can be increased only by increasing the ability modifier.",
  vex: "If you hit a creature with this weapon and deal damage to the creature, you have Advantage on your next attack roll against that creature before the end of your next turn.",
  sap: "If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.",
  cleave: "If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon’s damage, but don’t add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn."
};

const masteryLabel = key => CONFIG.DND5E.weaponMasteries[key]?.label ?? key;

/** Attacker, weapon and attack ability behind an attack message — or null. */
function masteryContext(attackMessage) {
  const activity = messageActivity(attackMessage);
  const weapon = activity?.item;
  const attacker = weapon?.actor;
  if ( !activity || !weapon || !attacker ) return null;
  return { activity, weapon, attacker, ability: activity.ability || "str" };
}

/**
 * What this target actually TOOK from the damage roll — the Vex/Slow gate ("hit AND dealt
 * damage"). The receipt is the truth when auto-apply ran (decide/receipt.js reads the entry);
 * WITHOUT a receipt the roll total is the best available approximation — a target-specific
 * immunity is invisible then, and that is accepted, the alternative being recomputing traits
 * by hand.
 */
function dealtFor(damageMessage, uuid) {
  const entry = damageMessage?.getFlag(MODULE_ID, "receipt")?.targets?.find(t => t.uuid === uuid);
  if ( entry ) return takenOf(entry);
  return damageMessage?.rolls?.reduce((n, r) => n + r.total, 0) ?? 0;
}

/** Route a hit's mastery to its payout or its ask. Runs on the elect, after application. */
export async function resolveHitMastery(damageMessage, attackMessage, hits) {
  try {
    const key = attackMessage.getFlag("dnd5e", "roll.mastery");
    if ( !key ) return;
    const ctx = masteryContext(attackMessage);
    if ( !ctx ) return;

    // The dead are skipped everywhere: chips on corpses and questions about them are noise
    // (the hopeless-hold precedent, applied to payouts) — EXCEPT Cleave, whose reminder is
    // about the attacker's NEXT swing, not the victim: the kill is its signature moment,
    // and the dead-skip ate it precisely then (walk-4 finding (u)).
    const struck = [];
    for ( const t of hits ) {
      const actor = await fromUuid(t.uuid);
      if ( actor instanceof Actor ) struck.push({ uuid: t.uuid, name: t.name, actor });
    }
    const live = struck.filter(t => (t.actor.system.attributes?.hp?.value ?? 0) > 0);
    if ( !live.length && (key !== "cleave") ) return;

    switch ( key ) {
      case "vex": {
        const dealt = live.filter(t => dealtFor(damageMessage, t.uuid) > 0);
        if ( !dealt.length ) return;
        await applyMasteryEffect(damageMessage ?? attackMessage, ctx, "vex", dealt);
        return postMasteryNotice(ctx, "vex", dealt);
      }
      case "sap":
        await applyMasteryEffect(damageMessage ?? attackMessage, ctx, "sap", live);
        return postMasteryNotice(ctx, "sap", live);
      case "cleave": {
        // A reminder, not a payout (ARCHITECTURE.md §6): the extra attack, its target
        // and its rolls stay native. Once per combat turn — the option is once per turn, so
        // is the nag; out of combat every hit reminds (the test range has no turns).
        if ( !struck.length ) return;
        const c = game.combat;
        if ( c?.started ) {
          const stamp = `${c.id}:${c.round}:${c.turn}`;
          if ( cleaveNoticed.get(ctx.attacker.uuid) === stamp ) return;
          cleaveNoticed.set(ctx.attacker.uuid, stamp);
        }
        // `struck`, not `live` — the corpse still anchors "within 5 feet of" (finding (u)).
        return postMasteryNotice(ctx, "cleave", struck);
      }
      case "slow": {
        const eligible = live.filter(t => (dealtFor(damageMessage, t.uuid) > 0)
          && (((t.actor.system.attributes?.movement?.walk ?? 0) > 0)
            || ((t.actor.system.attributes?.movement?.fly ?? 0) > 0)));
        return askOrTake(attackMessage, damageMessage, ctx, "slow", eligible);
      }
      case "topple": {
        const eligible = live.filter(t => !t.actor.statuses?.has?.("prone"));
        return askOrTake(attackMessage, damageMessage, ctx, "topple", eligible);
      }
      case "push":
        return askOrTake(attackMessage, damageMessage, ctx, "push", live);
      default:
        // nick is deliberately native — pure action economy, and ruling 1 says action economy
        // is not this module's job. ⚠ Anything ELSE arriving here is a mastery the SYSTEM has
        // and this module has never seen, and the old bare `return` made the two
        // indistinguishable: a dnd5e release adding a ninth mastery would have been swallowed
        // in silence forever. That is precisely the arrival the R4 tripwire exists to notice.
        if ( !MASTERY_NATIVE.has(key) && !warnedMasteries.has(key) ) {
          warnedMasteries.add(key);
          console.warn(`${TITLE} | Weapon mastery "${key}" is not one this module resolves (${[...MASTERY_KINDS].join("/")}) — left native. If the system added it, that is a NEW KIND against the R4 tripwire (DESIGN.md R4).`);
        }
        return;
    }
  } catch(err) {
    console.error(`${TITLE} | Mastery rider failed.`, err);
  }
}

// Graze is the anti-rider: it pays on the MISS, where no damage message will ever exist, so
// it hangs on the attack message itself. It deliberately reads only the attack AS ROLLED —
// a Shield later flipping someone's hit to a miss does not re-open Graze for them (corner
// acknowledged in PLAN.md; nobody has asked for it).
Hooks.on("createChatMessage", message => {
  if ( !setting(S.masteryRiders) || !isActiveGM() ) return;
  if ( message.getFlag("dnd5e", "roll.type") !== "attack" ) return;
  if ( message.getFlag("dnd5e", "roll.mastery") !== "graze" ) return;
  void resolveMissMastery(message);
});

async function resolveMissMastery(attackMessage) {
  try {
    const ctx = masteryContext(attackMessage);
    if ( !ctx ) return;
    // Graze alone rides the RESOLVER, not just the chain: a missed attack has no damage
    // button for a human to press, so with the resolver off there is no manual path to
    // stand in for this payout — and paying it anyway would apply damage a table that
    // turned auto-resolution off did not ask for.
    if ( !modeAllows(ctx.attacker) ) return;
    if ( (ctx.attacker.system.abilities?.[ctx.ability]?.mod ?? 0) <= 0 ) return;

    const hitSet = new Set(hitTargets(attackMessage).map(t => t.uuid));
    const missed = [];
    for ( const t of (attackMessage.getFlag("dnd5e", "targets") ?? []) ) {
      if ( hitSet.has(t.uuid) ) continue;
      const actor = await fromUuid(t.uuid);
      if ( (actor instanceof Actor) && ((actor.system.attributes?.hp?.value ?? 0) > 0) )
        missed.push({ uuid: t.uuid, name: t.name });
    }
    if ( missed.length ) await askOrTake(attackMessage, null, ctx, "graze", missed);
  } catch(err) {
    console.error(`${TITLE} | Graze failed.`, err);
  }
}

/** The optional masteries go through the gate: auto takes them, ask stamps the question. */
async function askOrTake(attackMessage, damageMessage, ctx, key, targets) {
  if ( !targets.length ) return; // hopeless: nothing left worth asking about
  const clean = targets.map(t => ({ uuid: t.uuid, name: t.name }));
  if ( setting(S.masteryAsk) === "auto" ) {
    return executeMasteryPayout(key, attackMessage, damageMessage, ctx, clean);
  }
  await stampMasteryAsk(attackMessage, damageMessage, ctx, key, clean);
}

async function executeMasteryPayout(key, attackMessage, damageMessage, ctx, targets) {
  switch ( key ) {
    case "slow": return applyMasteryEffect(damageMessage ?? attackMessage, ctx, "slow", targets);
    case "topple": return toppleCard(ctx, targets, damageMessage ?? attackMessage);
    case "push": return pushCard(ctx, targets);
    case "graze": return grazePayout(attackMessage, ctx, targets);
  }
}

/**
 * Apply one authored mastery effect to each target and join the damage card's effect
 * receipt. Same discipline as 1.9A: refresh a same-origin copy (this weapon's uuid) instead
 * of stacking, receipts are the visibility, revert is the native delete.
 *
 * Deliberately NOT routed through applyEffectsTo (the v1.8.0 convergence decision, recorded
 * so nobody re-attempts it): these chips are AUTHORED DATA, not copies of an existing
 * ActiveEffect document — there is no source document to toObject(), the dedupe key is the
 * module's own mastery flag + weapon origin rather than an origin uuid, and the durations
 * are combat-aware. Forcing that through the shared loop would mean a lambda per policy —
 * the three-lambda machine the timer note warned about. What IS shared is the receipt
 * bookkeeping (joinEffectReceipt), which is where the actual bugs lived.
 */
async function applyMasteryEffect(receiptMessage, ctx, key, targets) {
  const def = MASTERY_EFFECTS[key];
  if ( !def ) return;
  const inCombat = inRunningCombat(ctx.attacker);
  // ⚠ THE READ MOVED BELOW THE AWAITS (D3, 2026-08-22) — the same fix effect-riders.js got.
  // This used to clone the flag HERE and merge into that copy after a per-target loop full of
  // `await`s, a window wide enough for another chip applier to write and be overwritten.
  // Entries accumulate locally; the merge happens inside the serializer, at the end.
  const context = statContext(ctx.attacker.uuid); // the data-plane stamp, once per payout
  const entries = [];
  for ( const t of targets ) {
    const actor = (t.actor instanceof Actor) ? t.actor : await fromUuid(t.uuid);
    if ( !(actor instanceof Actor) ) continue;
    const duration = inCombat ? { rounds: 1 } : { seconds: 6 };
    const existing = actor.effects.find(e =>
      (e.getFlag(MODULE_ID, "mastery") === key) && (e.origin === ctx.weapon.uuid));
    let applied;
    if ( existing ) {
      const starts = ActiveEffect.implementation.getInitialDuration?.()?.duration ?? {};
      // ⚠ `?? existing`: Document#update returns UNDEFINED when the diff is empty — a
      // re-clock that changes nothing (same worldTime out of combat) — and the receipt
      // entry silently vanished with it (caught by probe 2026-08-15). The refresh is still
      // the payout; the receipt must say so either way.
      applied = (await existing.update({ duration: { ...starts, ...duration }, disabled: false })) ?? existing;
    } else {
      applied = await ActiveEffect.implementation.create({
        name: def.name, img: def.img,
        description: def.description(ctx.attacker),
        origin: ctx.weapon.uuid, disabled: false, transfer: false,
        duration,
        changes: def.changes?.() ?? [],
        flags: { [MODULE_ID]: { mastery: key } }
      }, { parent: actor });
    }
    if ( !applied ) continue;
    entries.push({ uuid: t.uuid, name: t.name, img: actor.img ?? null,
      effects: [effectRecord({ id: applied.id, name: applied.name,
        img: applied.img, description: applied.description }, context)] });
  }
  if ( entries.length && receiptMessage ) {
    await queueFlagWrite(receiptMessage, "effectReceipt", flag => {
      for ( const entry of entries ) joinEffectReceipt(flag, entry);
    });
  }
}

/** Topple: the demand, the native save link, and a GM affordance for the failure. */
async function toppleCard(ctx, targets, sourceMessage = null) {
  const dc = 8 + (ctx.attacker.system.attributes?.prof ?? 0)
    + (ctx.attacker.system.abilities?.[ctx.ability]?.mod ?? 0);
  const names = targets.map(t => t.name).join(", ");
  // The topple demand rides the SAVE machine's clock (v1.10.0, user call — the universal
  // design language: every table moment carries the deadline bar and one authoritative
  // clock). Same setting, same semantics: expiry ROLLS, because a demanded save is
  // mandatory. saveTimer 0 waits indefinitely — the GM prone button is always the
  // paper-roll backstop either way.
  const window = Math.max(0, Number(setting(S.saveTimer)) || 0);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: ctx.attacker }),
    content: bfCard({
      img: ctx.weapon.img, eyebrow: "Weapon Mastery — Topple", tone: "good",
      title: `${names}: Constitution save, DC ${dc}`,
      subtitle: `${ctx.attacker.name} — ${ctx.weapon.name}`,
      lines: [`[[/save ability=con dc=${dc} format=long]]`, "On a failure, it falls Prone."]
    }),
    flags: { [MODULE_ID]: { topple: {
      dc, ability: "con",
      attackerUuid: ctx.attacker.uuid,
      ...statContext(ctx.attacker.uuid), // the data-plane stamp
      // Provenance for the twin-ask supersede below: WHICH damage message earned this
      // demand. One swing asks once, whichever clients think they are the elect.
      sourceMessageId: sourceMessage?.id ?? null,
      weapon: { name: ctx.weapon.name, img: ctx.weapon.img },
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}),
      targets: targets.map(t => ({ uuid: t.uuid, name: t.name, done: false }))
    } } }
  });
}

/* --- the twin-ask supersede (the 2026-08-18 session's finding ⓪/②) -------------------------
 * `isActiveGM()` is per-USER, not per-CLIENT: two sessions logged in as the same account
 * BOTH pass it, and both stamp the ask — the session's twin Topple cards (00:37:24, both by
 * DM Assistant, contradictory verdicts: prone-by-timer AND saved-by-hand off one swing) are
 * the proof. Foundry exposes no cross-client session identity, so the race cannot be
 * prevented; it CAN be converged: every ask carries its provenance (sourceMessageId), and
 * when an ask arrives whose source already has an ELDER ask, the newcomer deletes itself.
 * Deterministic on every client (timestamp, then id), idempotent (a twin already deleted is
 * a caught no-op). The elder keeps the popups, the timer and the verdict. */
Hooks.on("createChatMessage", message => {
  if ( !isActiveGM() ) return;
  const flag = message.getFlag(MODULE_ID, "topple");
  if ( !flag?.sourceMessageId ) return;
  const elder = game.messages.contents.some(m => {
    if ( m.id === message.id ) return false;
    if ( m.getFlag(MODULE_ID, "topple")?.sourceMessageId !== flag.sourceMessageId ) return false;
    return (m.timestamp < message.timestamp)
      || ((m.timestamp === message.timestamp) && (m.id < message.id));
  });
  if ( elder ) {
    disarmToppleTimer(message.id);
    message.delete().catch(() => { /* the other twin got there first */ });
  }
});

/**
 * The topple save's table moment (v1.6.0, user call: "the GM didn't get a popup — the
 * cards are difficult to follow"). The same surface as the concentration ask — the story
 * over the native dialog's own controls (situational bonus, Advantage/Normal/Disadvantage)
 * — because it is the same class of moment: a save someone must roll NOW. Every button is
 * the same answer (roll, chained to the card so the fold judges); dismissing is not an
 * answer — the card's Roll button recalls this popup. Since v1.10.0 the demand carries the
 * save machine's timer (the flag's deadline), so the popup runs the same bar the card runs
 * — the pairing rule — and the buzzer below rolls whoever the clock catches.
 */
async function showTopplePopup(message, topple, target) {
  const actor = (() => { try { return fromUuidSync(target.uuid); } catch { return null; } })();
  let dialog;
  const roll = mode => rollToppleSave(message, target, {
    mode, bonus: dialog?.element?.querySelector('input[name="bf-topple-bonus"]')?.value ?? ""
  });
  dialog = await openMomentPopup(message, `topple:${target.uuid}`, actor, {
    title: `Topple — ${target.name}`, icon: "fa-solid fa-person-falling",
    content: bfCard({
      img: topple.weapon?.img ?? null,
      eyebrow: "Weapon Mastery — Topple",
      title: `${target.name}: Constitution save, DC ${topple.dc}`,
      subtitle: `${topple.weapon?.name ?? "The weapon"} demands it.`,
      // (z): the consequence in the property's own words — the verbatim final sentence of
      // the Topple rule (the demand speaks to the TARGET; the trigger half is the attacker's).
      lines: [ruleLine("On a failed save, the creature has the Prone condition.")],
      tone: "pending"
    }) + `
    <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;">
      <label style="flex:1;font-size:var(--font-size-12,12px);">Situational Bonus</label>
      <input type="text" name="bf-topple-bonus" placeholder="e.g. 1d4" autocomplete="off"
             style="flex:1;min-width:0;text-align:center;">
    </div>` + momentBarHTML(topple, "to roll"),
    buttons: [
      { action: "advantage", label: "Advantage", callback: () => roll("advantage") },
      { action: "normal", label: "Normal", default: true, callback: () => roll("normal") },
      { action: "disadvantage", label: "Disadvantage", callback: () => roll("disadvantage") }
    ]
  });
}

/** Roll one pending topple target's save, chained to the card — the fold does the rest.
 * The buzzer's press rides the same path with `timedOut`, straight and data-driven. */
async function rollToppleSave(message, target, { mode = null, bonus = null, timedOut = false } = {}) {
  const flag = message.getFlag(MODULE_ID, "topple");
  const entry = flag?.targets?.find(t => t.uuid === target.uuid);
  if ( !entry || entry.done ) return;
  const actor = await fromUuid(target.uuid);
  if ( !(actor instanceof Actor) ) return;
  await actor.rollSavingThrow(
    { ability: flag.ability || "con", target: flag.dc,
      ...rollConfigFor(mode, bonus) },
    { configure: false },
    { data: {
      "flags.dnd5e.originatingMessage": message.id,
      ...(timedOut ? { [`flags.${MODULE_ID}.timedOut`]: true } : {})
    } });
}

/* --- the topple buzzer: expiry ROLLS, on the elect (v1.10.0) --------------------------------
 * The save machine's semantics on the topple demand: the deadline is stamped on the flag by
 * the caster's clock, the elect owns the buzzer, and an unanswered target's save is rolled
 * straight and data-driven at expiry — a demanded save is mandatory, so the timer only ever
 * decides who pressed the button. An answer already in the log beats the clock; a target
 * that no longer exists is voided (the save buzzer's rule — a demand must never sit pending
 * forever behind a buzzer that already fired).
 * ------------------------------------------------------------------------------------------- */
const toppleTimers = new Map();

function armToppleTimer(message) {
  const flag = message?.getFlag(MODULE_ID, "topple");
  if ( !flag?.deadline || !isActiveGM() ) return;
  if ( !(flag.targets ?? []).some(t => !t.done) ) return;
  armDeadline(toppleTimers, message.id, flag.deadline, fireToppleTimer);
}

const disarmToppleTimer = messageId => disarmDeadline(toppleTimers, messageId);

async function fireToppleTimer(messageId) {
  try {
    const card = game.messages.get(messageId);
    const flag = card?.getFlag(MODULE_ID, "topple");
    if ( !flag ) return;
    for ( const t of (flag.targets ?? []) ) {
      if ( t.done ) continue;
      // An unfolded answer beats the clock, not races it.
      const landed = game.messages.contents.find(m =>
        (m.getFlag("dnd5e", "roll.type") === "save")
        && (m.getFlag("dnd5e", "originatingMessage") === card.id)
        && (m.getAssociatedActor?.()?.uuid === t.uuid));
      if ( landed ) { void foldToppleSave(landed); continue; }
      const actor = await fromUuid(t.uuid).catch(() => null);
      if ( !(actor instanceof Actor) ) {
        // Through the serializer (D3): the read used to sit above this `await fromUuid`, and
        // this loop walks every target, so it races itself.
        await queueFlagWrite(card, "topple", live => {
          const gone = live.targets?.find(x => !x.done && (x.uuid === t.uuid));
          if ( !gone ) return false;
          gone.done = true;
          gone.outcome = "gone";
          gone.applied = true; // nothing to press
          gone.answeredAt = Date.now();
        });
        continue;
      }
      await rollToppleSave(card, t, { timedOut: true });
    }
  } catch(err) {
    console.error(`${TITLE} | Topple buzzer failed.`, err);
  }
}

/**
 * The Topple card folds its own save (user call 2026-08-16 — the Phase 2 seam pressed in
 * place, v1.5.0). The elect judges a Constitution save that answers a still-pending topple
 * target against the DC stored on the card — the ask's DC, exactly the concentration fold's
 * rule — and a failure presses the button itself: Prone, announced. The save ROLL stays
 * human-pressed; the GM per-target button remains for saves rolled on paper.
 *
 * Recognizer (the 2.5 shape): the roll's actor must be a still-pending target, the ability
 * must match, and the roll either chains to the topple card itself (the enricher click —
 * buildPost stamps originatingMessage from the enclosing card, basic-roll.mjs:173) or
 * chains to nothing at all (a bare sheet roll). A save chained to any OTHER message belongs
 * to that chain and is never read as a Topple answer. Pre-v1.5.0 cards carry no dc on the
 * flag and are skipped — their GM buttons still work.
 */
Hooks.on("createChatMessage", message => {
  if ( !isActiveGM() ) return;
  if ( message.getFlag("dnd5e", "roll.type") !== "save" ) return;
  void foldToppleSave(message);
});

/**
 * The topple failure's consequence — the press, the announcement, and the resume receipt.
 * Split from the fold so the crash-resume can re-drive it: if the folding client dies inside
 * the verdict pause, the entry sits done+prone with no Prone on the token and no card — any
 * GM render past the resume horizon re-runs this. Idempotent by the `applied` receipt, and
 * the press VERIFIES (forceStatus) instead of trusting a toggle that no-ops silently over a
 * disabled leftover or a vetoed create (the live 2026-08-16 report).
 */
async function applyToppleFailure(card, uuid) {
  const flag = foundry.utils.deepClone(card.getFlag(MODULE_ID, "topple"));
  const entry = flag?.targets?.find(t => t.uuid === uuid);
  if ( !entry || (entry.outcome !== "prone") || entry.applied ) return;
  const actor = (() => { try { return fromUuidSync(uuid); } catch { return null; } })();
  // The chip names its source (v1.11.0, finding ⑤) — pre-v1.11.0 cards carry no
  // attackerUuid and press sourceless, exactly as before.
  if ( actor instanceof Actor ) await forceStatus(actor, "prone", { origin: flag.attackerUuid ?? null });
  await ChatMessage.create({
    speaker: card.speaker,
    content: bfCard({
      img: flag.weapon?.img, eyebrow: "Weapon Mastery — Topple", tone: "good",
      title: `${entry.name} falls Prone`,
      subtitle: `Constitution save ${entry.total ?? "?"} vs DC ${flag.dc}`
        + `${entry.timedOut ? " — rolled by the timer" : ""}`
    })
  });
  // ⚠ Through the serializer, and the claim re-checked INSIDE it (D3): two awaits stand
  // between the guard above and this write, which is exactly long enough for the fold to
  // record another target on the same flag and be overwritten.
  await queueFlagWrite(card, "topple", live => {
    const own = live.targets?.find(t => t.uuid === uuid);
    if ( !own || own.applied ) return false;
    own.applied = true;
  });
}

async function foldToppleSave(saveMessage) {
  try {
    const actor = saveMessage.getAssociatedActor?.();
    const total = saveMessage.rolls?.[0]?.total;
    if ( !actor || (typeof total !== "number") ) return;
    const originId = saveMessage.getFlag("dnd5e", "originatingMessage");
    let cards;
    if ( originId ) {
      const origin = game.messages.get(originId);
      if ( !origin?.getFlag(MODULE_ID, "topple") ) return; // another chain's save
      cards = [origin];
    } else {
      // ANOTHER MACHINE'S STAMPED ANSWER IS NEVER A TOPPLE ANSWER (the 2026-08-18 session's
      // finding ④, probe-proven): Edda's concentration answer — respondsTo on the roll, no
      // originatingMessage — fell through to this whole-log branch and was claimed as her
      // Topple save too; one roll, two verdicts, and her still-open Topple popup vanished
      // resolved-by-theft. saves.js has refused respondsTo rolls since v1.7.0; this fold
      // was the only recognizer missing the guard.
      if ( saveMessage.getFlag(MODULE_ID, "respondsTo") ) return;
      // And a BARE roll defers to the older machines, exactly saves.js's rule (priority
      // conc → saves → topple, the ship order): when a pending concentration ask or save
      // demand names this actor with a matching ability, the bare roll is theirs — the
      // topple's own popup and buzzer still stand, so nothing goes unresolved.
      const ability = saveMessage.getFlag("dnd5e", "roll.ability") ?? null;
      const spokenFor = game.messages.some(m => {
        const c = m.getFlag(MODULE_ID, "concentration");
        if ( c && (c.status === "pending") && (c.actorUuid === actor.uuid)
          && (c.ability === ability) ) return true;
        const s = m.getFlag(MODULE_ID, "saves");
        return !!s && (s.status === "pending") && s.abilities?.includes(ability)
          && s.targets?.some(t => !t.done && (t.uuid === actor.uuid));
      });
      if ( spokenFor ) return;
      // Whole-log by design (the tail-window lesson); the oldest pending card answers first.
      cards = game.messages.contents.filter(m => m.getFlag(MODULE_ID, "topple"));
    }
    for ( const card of cards ) {
      const flag = foundry.utils.deepClone(card.getFlag(MODULE_ID, "topple"));
      if ( !(flag?.dc > 0) ) continue;
      if ( flag.ability && (saveMessage.getFlag("dnd5e", "roll.ability") !== flag.ability) ) continue;
      const entry = flag.targets?.find(t => !t.done && (t.uuid === actor.uuid));
      if ( !entry ) continue;
      const success = total >= flag.dc;
      // ⚠ Through the serializer, claim repeated inside it (D3): per-target verdicts on one
      // shared array, and two saves answering one card land in the same tick. Re-finding the
      // entry under `!done` is also what stops two folds claiming the same roll.
      let claimed = false;
      await queueFlagWrite(card, "topple", live => {
        const own = live.targets?.find(t => !t.done && (t.uuid === actor.uuid));
        if ( !own ) return false;
        claimed = true;
        own.done = true;
        own.outcome = success ? "saved" : "prone";
        own.total = total;
        if ( saveMessage.getFlag(MODULE_ID, "timedOut") ) own.timedOut = true;
        // The crash-resume contract (the saves machine's `applied` discipline): answeredAt is
        // the horizon's clock and the new-era marker; a success has no consequence to resume.
        own.answeredAt = Date.now();
        if ( success ) own.applied = true;
      });
      // Another fold got there first — it owns the announcement and the consequence.
      if ( !claimed ) continue;
      // ⚠ Re-read, do NOT consult `flag`: it is the pre-write clone now that the verdict is
      // recorded inside the serializer, so it still shows this target as pending and the
      // clock would never be disarmed.
      if ( (card.getFlag(MODULE_ID, "topple")?.targets ?? []).every(t => t.done) ) {
        disarmToppleTimer(card.id);
      }
      if ( !success ) {
        await dramaticVerdictPause(saveMessage); // same instant-verdict class as the fold
        await applyToppleFailure(card, entry.uuid);
      } else {
        // A SUCCESS ANNOUNCES TOO (the 2026-08-18 session's finding ⑤, overturning the
        // v1.6.0 "closes quietly" choice): a public ask with a bar that resolves in
        // silence reads as a dropped machine — the user pressed Prone by hand all night,
        // sometimes on creatures that had SAVED, because nothing said the verdict landed.
        // Same shape as concentration's "holds" card: one line, the roll against the DC.
        await dramaticVerdictPause(saveMessage);
        // Source-then-result and the saver's own card (v1.19.x findings ⑦/⑧ — the same
        // sweep as the save verdict line).
        const stander = (() => { try { return fromUuidSync(entry.uuid); } catch { return null; } })();
        await ChatMessage.create({
          speaker: (stander instanceof Actor) ? ChatMessage.getSpeaker({ actor: stander }) : card.speaker,
          content: bfCard({
            img: flag.weapon?.img, eyebrow: "Weapon Mastery — Topple", tone: "neutral",
            title: `Topple — ${entry.name} stays standing`,
            subtitle: `Constitution save ${entry.total ?? "?"} vs DC ${flag.dc}`
              + `${entry.timedOut ? " — rolled by the timer" : ""}`
          })
        });
      }
      return; // one save answers one card
    }
  } catch(err) {
    console.error(`${TITLE} | Topple fold failed.`, err);
  }
}

/** Push: announce the option. Tokens are never moved — sliding one is free at the table. */
async function pushCard(ctx, targets) {
  const names = targets.map(t => t.name).join(", ");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: ctx.attacker }),
    content: bfCard({
      img: ctx.weapon.img, eyebrow: "Weapon Mastery — Push", tone: "good",
      title: `${ctx.attacker.name} can push ${names} 10 feet`,
      subtitle: `${ctx.weapon.name} — straight away, Large or smaller`,
      lines: ["Move the token; nothing is automated."]
    })
  });
}

/** Graze: the miss still pays the attack ability's modifier, through the shared applier. */
async function grazePayout(attackMessage, ctx, targets) {
  const mod = ctx.attacker.system.abilities?.[ctx.ability]?.mod ?? 0;
  if ( mod <= 0 ) return;
  const type = [...(ctx.weapon.system.damage?.base?.types ?? [])][0] ?? "";
  await applyDamagesWithReceipt(attackMessage, targets, [{
    value: mod, type, properties: new Set(ctx.weapon.system.properties ?? [])
  }], { note: "Graze — the miss still pays" });
}

/* --- the reminder: an informational table moment (1.9C amendment, 2026-08-16) -------------- */

/** What each reminder says — the fact, in the mastery's own words. */
const NOTICE_TEXT = {
  // (z): the rule line is the property's own text, verbatim; the claim/chip/arm notes stay
  // as the module's hints.
  vex: (ctx, names) => ({
    title: "Vex — Advantage on your next attack",
    lines: [ruleLine(MASTERY_RULES.vex),
      `Against ${names}. Claim it in the roll dialog — nothing applies it for you.`]
  }),
  sap: (ctx, names) => ({
    title: `Sap — ${names} at Disadvantage`,
    lines: [ruleLine(MASTERY_RULES.sap),
      `The chip on ${names} carries the rule; the roll dialog is where it is honoured.`]
  }),
  cleave: (ctx, names) => ({
    title: "Cleave — one extra attack available",
    // ⚠ v1.19.0 (FLOW item 8): the old copy said "Roll it from the sheet" and told the player
    // to omit the ability modifier — a move the sheet cannot make, so the instruction was
    // unfollowable and, with auto-damage on, the machine rolled `1dX+mod` before any human
    // could intervene. The card offers the ARM instead: press it and the next damage roll
    // with this weapon drops the flat ability-modifier part itself.
    lines: [ruleLine(MASTERY_RULES.cleave),
      `Press "Arm the Cleave" and the next ${ctx.weapon.name} damage roll drops the modifier for you; Dismiss to resolve it yourself — or if you've already Cleaved this turn.`]
  })
};

/** Cleave reminds once per combat turn per attacker. */
const cleaveNoticed = new Map();

/**
 * The elect posts the reminder card — the durable record, and the bus the popup rides: the
 * card replicates everywhere, and whichever client owns the moment (canAnswerFor — the
 * ask's own election) pops the view. "The design is for people to know weapon masteries
 * and not forget they have those" (user call, 2026-08-16).
 */
async function postMasteryNotice(ctx, key, targets) {
  const names = targets.map(t => t.name).join(", ");
  const { title, lines } = NOTICE_TEXT[key](ctx, names);
  const subtitle = `${ctx.attacker.name} — ${ctx.weapon.name}`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: ctx.attacker }),
    content: bfCard({
      img: ctx.weapon.img, eyebrow: `Weapon Mastery — ${masteryLabel(key)}`, tone: "good",
      title, subtitle, lines
    }),
    flags: { [MODULE_ID]: { masteryNotice: {
      key, attackerUuid: ctx.attacker.uuid,
      // `id` since v1.19.0 — the Cleave arm keys the strip on "this exact weapon", and a
      // name is not an identity (two daggers). Older cards without it arm nothing, harmlessly.
      weapon: { id: ctx.weapon.id, name: ctx.weapon.name, img: ctx.weapon.img },
      title, subtitle, lines,
      deadline: Date.now() + 15000, window: 15
    } } }
  });
}

/**
 * The reminder popup: an informational table moment — ONE control (OK) and a 15-second
 * auto-dismiss with the drain bar, because dismissal and expiry are the same non-event and
 * nothing downstream waits. Deliberately NOT a decision: the two-control rule governs
 * decisions, and a reminder has nothing to decide (ARCHITECTURE.md §6). Stale renders
 * never pop — the deadline gates the popup, while the card stays as the record.
 *
 * ⚠ CLEAVE IS THE RECORDED EXCEPTION since v1.19.0 (FLOW item 8): its popup IS a decision —
 * "is my next attack the Cleave?" — so it carries the decision pair (Arm the Cleave / Dismiss)
 * instead of OK. That is the design-conforming reading of FLOW's "the card grows ONE button":
 * cards stay recall-only (the HANDOFF one-input-surface rule), so the control lives on the
 * popup and the card's button below recalls it. Never pressed ⇒ today's behaviour exactly —
 * the auto-dismiss and the drain bar are unchanged, and dismissal arms nothing.
 */
async function showMasteryNotice(message, notice) {
  const attacker = (() => { try { return fromUuidSync(notice.attackerUuid); } catch { return null; } })();
  // THE ACK (ARCHITECTURE.md §5 law 3, finding (j)): ANY notice button resolves the card's
  // pending presentation — bar, recall, popup, all of it. Arm additionally arms (and the
  // "Cleave — armed" card the render block draws is gated on the arm, not the ack, so it
  // stays). Closing the popup with the X remains a non-event: the bar drains out.
  const buttons = (notice.key === "cleave")
    ? [
      { action: "arm", label: "Arm the Cleave", default: true,
        callback: () => { void armCleave(notice); void acknowledgeMoment(message, "masteryNotice"); } },
      { action: "dismiss", label: "Dismiss",
        callback: () => acknowledgeMoment(message, "masteryNotice") }
    ]
    : [{ action: "ok", label: "OK", default: true,
        callback: () => acknowledgeMoment(message, "masteryNotice") }];
  await openMomentPopup(message, "notice", attacker, {
    title: `${masteryLabel(notice.key)} — ${notice.weapon?.name ?? ""}`, icon: "fa-solid fa-medal",
    width: 420,
    content: bfCard({
      img: notice.weapon?.img, eyebrow: `Weapon Mastery — ${masteryLabel(notice.key)}`,
      tone: "good", title: notice.title, subtitle: notice.subtitle, lines: notice.lines ?? []
    }) + momentBarHTML(notice, "reminder"),
    buttons,
    autoCloseAt: notice.deadline
  });
}

/* --- the Cleave arm (v1.19.0, FLOW item 8) --------------------------------------------------
 * The player DECLARES the cleave; the machine does the one thing the sheet cannot: drop the
 * flat ability-modifier part from that one damage roll. Silent detection was REJECTED and
 * stays rejected (the 1.9 fence: at level 5, Extra Attack makes "second swing, same weapon,
 * different target" an ordinary turn — a guess would strip real damage). The arm is an ACTOR
 * flag written by the arming client (the attacker's own — the same locality as the v1.18.0
 * popup: the reminder popped where canAnswerFor(attacker), and preRollDamageV2 runs on
 * whichever client rolls, with the actor flag replicated to both). One-shot, and stale by
 * STAMP COMPARISON rather than by a timer: in combat the arm carries `${combat.id}:${round}:
 * ${turn}` (the cleaveNoticed idiom) and any mismatch at read time IS expiry — no hook, no
 * elect, survives a reload. Out of combat there is no turn to end, so the arm expires after
 * 60s or on use, whichever comes first.
 * ------------------------------------------------------------------------------------------- */

const CLEAVE_ARM_TTL_MS = 60_000;   // out-of-combat only; in combat the turn stamp governs

async function armCleave(notice) {
  const attacker = (() => { try { return fromUuidSync(notice.attackerUuid); } catch { return null; } })();
  if ( !(attacker instanceof Actor) || !notice.weapon?.id ) return;
  await attacker.setFlag(MODULE_ID, "cleaveArm", {
    itemId: notice.weapon.id, itemName: notice.weapon.name ?? "",
    stamp: combatStamp(), armedAt: Date.now()
  });
  ui.notifications.info(`${TITLE}: Cleave armed — the next ${notice.weapon.name} damage roll drops the ability modifier.`);
}

/** Freshness, read-only — the render block asks the same question without consuming. */
function cleaveArmFresh(arm) {
  if ( !arm ) return false;
  return arm.stamp
    ? (arm.stamp === combatStamp())
    : ((combatStamp() === null) && (Date.now() - (arm.armedAt ?? 0) <= CLEAVE_ARM_TTL_MS));
}

/** The live arm on an actor, with staleness applied at read time (stale ⇒ unset, null). */
function liveCleaveArm(actor) {
  const arm = actor?.getFlag(MODULE_ID, "cleaveArm");
  if ( !arm ) return null;
  if ( !cleaveArmFresh(arm) ) { void actor.unsetFlag(MODULE_ID, "cleaveArm"); return null; }
  return arm;
}

/** The arm that will bite THIS item's next damage roll, or null — the v1.19.x damage
 * popup's question (finding ③: the popup must say the Cleave before the dice do). Read-only;
 * the strip below stays the only consumer. Reached from auto-damage.js by LAZY import — the
 * entry evaluates that file before this one, and a static edge would drag concentration.js
 * ahead of hold.js (the §9 order the entry warns about). */
export function cleaveArmedFor(item) {
  if ( item?.type !== "weapon" ) return null;
  const arm = liveCleaveArm(item.actor);
  return (arm && (arm.itemId === item.id)) ? arm : null;
}

// THE STRIP. Runs on whichever client rolls the damage (the resolver's auto-roll, the v1.18.0
// popup's button, or a native press — all three converge here), synchronously, before the
// dice exist. The arm is consumed either way; the strip itself is skipped when the modifier
// is NEGATIVE (the RAW corner, mirroring the system's own off-hand predicate at
// AttackActivity#_processDamagePart: removing a minus would RAISE the damage).
Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
  try {
    const activity = config.subject;
    if ( activity?.type !== "attack" ) return;
    const item = activity.item;
    if ( item?.type !== "weapon" ) return;
    const arm = liveCleaveArm(item.actor);
    if ( !arm || (arm.itemId !== item.id) ) return;
    void item.actor.unsetFlag(MODULE_ID, "cleaveArm");   // one-shot, consumed even when skipped
    // The BASE entry, never index 0 — ammunition can splice ahead of it (probe-preroll-parts).
    const base = (config.rolls ?? []).find(r => r.base === true);
    if ( !base ) return;
    if ( (base.data?.mod ?? 0) < 0 ) return;             // the RAW corner: a penalty stays
    const ix = (base.parts ?? []).findIndex(p => String(p).includes("@mod"));
    if ( ix < 0 ) return;                                 // nothing to drop (thrown natural, offhand…)
    base.parts.splice(ix, 1);                             // "@mod" only — @magicalBonus/@ammoBonus stay
    // The receipt line: message-data mutations at this hook persist onto the created damage
    // message (probe-preroll-parts assertion 5), so the card can SAY the modifier was dropped.
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.cleaveStripped`,
      { itemName: arm.itemName ?? item.name });
  } catch(err) {
    console.error(`${TITLE} | Cleave strip failed.`, err);
  }
});

/* --- the ask: stamp → row → popup → answer → execute -------------------------------------- */

const masteryTimers = new Map();

async function stampMasteryAsk(attackMessage, damageMessage, ctx, key, targets) {
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  await attackMessage.setFlag(MODULE_ID, "mastery", {
    status: "pending", key,
    weapon: { name: ctx.weapon.name, img: ctx.weapon.img },
    attackerUuid: ctx.attacker.uuid,
    damageMessageId: damageMessage?.id ?? null,
    ...statContext(ctx.attacker.uuid), // the data-plane stamp — every moment flag carries it
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}),
    targets
  });
  armMasteryTimer(attackMessage);
}

/** One answer, first writer wins. The decider owns the attack message (it is their roll). */
async function answerMastery(message, answer, { timedOut = false } = {}) {
  const m = foundry.utils.deepClone(message.getFlag(MODULE_ID, "mastery") ?? {});
  if ( (m.status !== "pending") || m.answer ) return;
  m.answer = answer;
  m.answeredAt = Date.now();   // the crash-resume horizon (the topple discipline)
  if ( timedOut ) m.timedOut = true;
  await message.setFlag(MODULE_ID, "mastery", m);
}

/**
 * The elect claims the answer, then pays it out. The claim-first write makes SEQUENTIAL
 * re-fires see "done" — but the render hook's resume check and the update watcher can both
 * invoke this in the same tick, before the claim has landed, and each concurrent reader
 * sees "pending" and pays again (three Slowed chips, −30 speed — caught by smoke-effects
 * §5c the day the resume check was added). Same in-memory latch as continueHold, for the
 * same reason: the race is same-client concurrency, and the elect gate already serializes
 * across clients.
 */
const masteryExecutions = new Set();

async function executeMasteryAnswer(message) {
  if ( masteryExecutions.has(message.id) ) return;
  masteryExecutions.add(message.id);
  try {
    const m = foundry.utils.deepClone(message.getFlag(MODULE_ID, "mastery") ?? {});
    if ( (m.status !== "pending") || !m.answer ) return;
    m.status = "done";
    m.outcome = (m.answer === "use") ? "used" : (m.timedOut ? "timed out" : "passed");
    disarmMasteryTimer(message.id);
    await message.setFlag(MODULE_ID, "mastery", m);
    if ( m.answer !== "use" ) return;
    const ctx = masteryContext(message);
    if ( !ctx ) return;
    const damageMessage = m.damageMessageId ? game.messages.get(m.damageMessageId) : null;
    await executeMasteryPayout(m.key, message, damageMessage, ctx, m.targets ?? []);
  } finally {
    masteryExecutions.delete(message.id);
  }
}

// The answer channel: every client closes an answered popup; the elect executes. The topple
// demand shares this watcher: a done entry's popup closes wherever it lives (a sheet roll
// answering the topple used to leave the popup open, still asking — the §4.3 withdrawal
// rule), and the buzzer disarms the moment nothing is pending.
Hooks.on("updateChatMessage", message => {
  const m = message.getFlag(MODULE_ID, "mastery");
  if ( m ) {
    const dialog = livePopups.get(popupKey(message.id, "mastery"));
    if ( dialog && ((m.status !== "pending") || m.answer) ) void dialog.close();
    if ( isActiveGM() && (m.status === "pending") && m.answer ) void executeMasteryAnswer(message);
  }

  // A durably-acknowledged notice closes its popup wherever it lives (the ACK, law 2) —
  // the local-ack path closes its own popup by the button press itself.
  if ( message.getFlag(MODULE_ID, "masteryNotice")?.acknowledged ) {
    const dialog = livePopups.get(popupKey(message.id, "notice"));
    if ( dialog ) void dialog.close();
  }

  const topple = message.getFlag(MODULE_ID, "topple");
  if ( topple ) {
    for ( const t of (topple.targets ?? []) ) {
      if ( !t.done ) continue;
      const dialog = livePopups.get(popupKey(message.id, `topple:${t.uuid}`));
      if ( dialog ) void dialog.close();
    }
    if ( !(topple.targets ?? []).some(t => !t.done) ) disarmToppleTimer(message.id);
    else armToppleTimer(message);
  }
});

// The shown-latches ride ui.js's one delete-sweep; only this machine's clocks disarm here.
Hooks.on("deleteChatMessage", message => {
  disarmMasteryTimer(message.id);
  disarmToppleTimer(message.id);
});

// armAskTimer/disarmAskTimer moved to ui.js at round 3 — the elect-owned single-answer clock
// is the spine's, not this machine's. The imports above carry them back in.

/** Expiry answers Pass — the AFK fallback for a decision nobody made. */
const armMasteryTimer = message =>
  armAskTimer(masteryTimers, message, "mastery", live => answerMastery(live, "pass", { timedOut: true }));
const disarmMasteryTimer = messageId => disarmAskTimer(masteryTimers, messageId);

/** The Use/Pass popup — the same two controls for everybody, on the hold's own bar. */
async function showMasteryPopup(message, m) {
  const attacker = (() => { try { return fromUuidSync(m.attackerUuid); } catch { return null; } })();
  const label = masteryLabel(m.key);
  await openMomentPopup(message, "mastery", attacker, {
    title: `${label} — ${m.weapon?.name ?? ""}`, icon: "fa-solid fa-medal", width: 420,
    content: bfCard({
      img: m.weapon?.img, eyebrow: "Weapon Mastery", tone: "neutral",
      title: `${label}: use it?`,
      subtitle: `${attacker?.name ?? "The attacker"} — ${m.weapon?.name ?? "weapon"}`,
      lines: [MASTERY_RULES[m.key] ?? "", `Against: ${(m.targets ?? []).map(t => t.name).join(", ")}`]
    }) + holdBarHTML(m),
    buttons: [
      { action: "use", label: `Use ${label}`, default: true,
        callback: () => answerMastery(message, "use") },
      { action: "pass", label: "Pass",
        callback: () => answerMastery(message, "pass") }
    ]
  });
}

// The card rows: the mastery ask (pending: bar + Answer; done: the outcome), and the Topple
// card's GM prone affordance. Stateless like every render hook here.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const m = message.getFlag(MODULE_ID, "mastery");
  if ( m ) {
    const row = document.createElement("div");
    row.className = "battleflow-mastery";
    const label = masteryLabel(m.key);
    const pending = m.status === "pending";
    const outcome = m.outcome === "used" ? `${label} used`
      : m.outcome === "timed out" ? "Passed (timer)" : "Passed";
    row.innerHTML = bfCard({
      img: m.weapon?.img, eyebrow: "Weapon Mastery",
      tone: pending ? "neutral" : (m.outcome === "used" ? "good" : "neutral"),
      title: pending ? `${label} — ${(m.targets ?? []).map(t => t.name).join(", ")}` : outcome,
      subtitle: pending ? (MASTERY_RULES[m.key] ?? "") : `${label} — ${m.weapon?.name ?? ""}`
    }) + (pending ? holdBarHTML(m) : "");
    html.querySelector(".message-content")?.appendChild(row);
    // The bar only drains once synced — the popup always got this via openManagedPopup and
    // the card row forgot it, so the card sat frozen at full (reported live 2026-08-16).
    if ( pending ) scheduleBarSync(row);

    if ( pending ) {
      armMasteryTimer(message);
      // Resume an ask that answered while nobody could execute: the elect reloaded (or came
      // up later) between the answer flag landing and the payout. Same stateless-view
      // discipline as the hold's resume check; executeMasteryAnswer is claim-first.
      if ( m.answer && isActiveGM() ) void executeMasteryAnswer(message);
      const attacker = (() => { try { return fromUuidSync(m.attackerUuid); } catch { return null; } })();
      if ( canAnswerFor(attacker) && !m.answer ) {
        // ONE input surface: the popup decides, the card recalls a dismissed popup.
        const shownKey = popupKey(message.id, "mastery");
        if ( !shownMoments.has(shownKey) ) {
          shownMoments.add(shownKey);
          void showMasteryPopup(message, m);
        }
        row.appendChild(momentButton("Answer", () => {
          void showMasteryPopup(message, message.getFlag(MODULE_ID, "mastery"));
        }, { margin: "0.25rem 0 0" }));
      }
    }
  }

  // The reminder popup rides the notice card exactly as the ask popup rides its flag: the
  // deadline gates staleness (an old log render must never nag), the shown-set gates
  // re-pops, and canAnswerFor picks the client that owns the moment.
  const notice = message.getFlag(MODULE_ID, "masteryNotice");
  if ( notice ) {
    // A notice is LIVE while its window drains AND nobody has acknowledged it (the ACK,
    // law 2 — finding (j)): any button press resolves the presentation, so bar, auto-pop
    // and recall all gate here. The pairing rule (v1.10.0) is otherwise unchanged: while
    // the popup's drain runs for its owner, the SAME bar runs on the card for the table,
    // and momentBarHTML returns "" once the moment has passed — stateless, every client.
    const live = (notice.deadline > Date.now()) && !momentAcknowledged(message, "masteryNotice");
    if ( live ) {
      const bar = document.createElement("div");
      bar.innerHTML = momentBarHTML(notice, "reminder");
      if ( bar.innerHTML.trim() ) {
        html.querySelector(".message-content")?.appendChild(bar);
        scheduleBarSync(bar);
      }
    }
    const attacker = (() => { try { return fromUuidSync(notice.attackerUuid); } catch { return null; } })();
    const shownKey = popupKey(message.id, "notice");
    if ( canAnswerFor(attacker) && live && !shownMoments.has(shownKey) ) {
      shownMoments.add(shownKey);
      void showMasteryNotice(message, notice);
    }
    // Cleave only (v1.19.0): the card states the arm when it stands, and recalls the decision
    // popup while the moment is live — one input surface, the card watches (read-only here:
    // display must never consume a stale arm, the strip owns that).
    if ( notice.key === "cleave" ) {
      const arm = (attacker instanceof Actor) ? attacker.getFlag(MODULE_ID, "cleaveArm") : null;
      if ( cleaveArmFresh(arm) && (arm.itemId === notice.weapon?.id) ) {
        const armed = document.createElement("div");
        armed.innerHTML = bfCard({
          img: notice.weapon?.img, eyebrow: "Weapon Mastery — Cleave", tone: "good",
          title: "Cleave — armed",
          subtitle: `The next ${arm.itemName || "weapon"} damage roll drops the ability modifier.`
        });
        html.querySelector(".message-content")?.appendChild(armed);
      } else if ( canAnswerFor(attacker) && live ) {
        html.querySelector(".message-content")?.appendChild(momentButton("Answer", () => {
          void showMasteryNotice(message, message.getFlag(MODULE_ID, "masteryNotice"));
        }, { margin: "0.25rem 0 0" }));
      }
    }
  }

  // The strip's receipt (v1.19.0): the damage card SAYS the modifier was dropped, so the roll
  // reading lower than usual is explained where everyone looks. Stateless, from the flag the
  // strip stamped at preRollDamageV2 time.
  const stripped = message.getFlag(MODULE_ID, "cleaveStripped");
  if ( stripped ) {
    const line = document.createElement("div");
    line.innerHTML = bfCard({
      eyebrow: "Weapon Mastery — Cleave", tone: "neutral",
      title: "Cleave — ability modifier dropped",
      subtitle: `${stripped.itemName || "The weapon"}'s Cleave — this roll takes no ability modifier.`
    });
    html.querySelector(".message-content")?.appendChild(line);
  }

  const topple = message.getFlag(MODULE_ID, "topple");
  if ( topple?.targets?.length ) {
    // The demand's bar, card-side (v1.10.0 — the pairing rule): drains in step with every
    // popup, and the buzzer re-arms statelessly on render (a reload resumes the clock from
    // the flag's absolute deadline, the hold timer's discipline).
    if ( topple.deadline && topple.targets.some(t => !t.done) ) {
      const bar = document.createElement("div");
      bar.innerHTML = momentBarHTML(topple, "to roll");
      if ( bar.innerHTML.trim() ) {
        html.querySelector(".message-content")?.appendChild(bar);
        scheduleBarSync(bar);
      }
      armToppleTimer(message);
    }
    for ( const t of topple.targets ) {
      // Crash-resume: a folded failure whose press and announcement died with their client —
      // done+prone, unapplied, stale past any live pause. Elect-driven, new-era stamps only.
      if ( (t.outcome === "prone") && t.answeredAt && !t.applied && isActiveGM()
        && (Date.now() - t.answeredAt > 20_000) ) void applyToppleFailure(message, t.uuid);
      if ( t.done ) continue;
      const actor = (() => { try { return fromUuidSync(t.uuid); } catch { return null; } })();

      // ⚠ The native [[/save]] enricher rolls for whatever token is SELECTED — which right
      // after an attack is the ATTACKER, so the GM rolled Morgash's save at the dummy's
      // topple and the fold rightly ignored it (bit live 2026-08-16). The module's own
      // surface aims at the RIGHT actor: a popup on the decider's client (v1.6.0 — "the
      // cards are difficult to follow"), with the card's Roll button as its recall.
      if ( topple.dc && canAnswerFor(actor) ) {
        // v1.19.x finding (h): canAnswerFor alone routes — the extra `isGM &&
        // hasPlayerOwner` quiet was mutually exclusive with its active-owner check, so a
        // solo-GM room watched the buzzer eat every player-owned save ("failed (timer)",
        // twice, in the walk's log). The v1.12.0 taste is intact: an ONLINE owner still
        // excludes the GM inside canAnswerFor; only the nobody-home case now pops.
        const shownKey = popupKey(message.id, `topple:${t.uuid}`);
        if ( !shownMoments.has(shownKey) ) {
          shownMoments.add(shownKey);
          void showTopplePopup(message, topple, t);
        }
        html.querySelector(".message-content")?.appendChild(momentButton(`Roll save — ${t.name}`, () => {
          void showTopplePopup(message, message.getFlag(MODULE_ID, "topple"), t);
        }));
      }

      if ( game.user.isGM ) {
        html.querySelector(".message-content")?.appendChild(momentButton(`${t.name} failed — Prone`, async () => {
          const live = await fromUuid(t.uuid);
          if ( live instanceof Actor ) await forceStatus(live, "prone",
            { origin: message.getFlag(MODULE_ID, "topple")?.attackerUuid ?? null });
          // Through the serializer (D3): the GM's press lands after an await, on the same
          // per-target array a fold may be writing.
          await queueFlagWrite(message, "topple", live2 => {
            const entry = live2.targets?.find(x => x.uuid === t.uuid);
            if ( !entry ) return false;
            entry.done = true;
            entry.outcome = "prone";
            entry.applied = true;
            entry.answeredAt = Date.now();
          });
        }));
      }
    }
  }
});

