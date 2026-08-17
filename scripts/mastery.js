/**
 * Battle Flow — Phase 1.9B/C: weapon mastery riders, the mastery ask, the topple fold and its popup, and the reminders.
 * Split from battleflow.js (design.md §9); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM } from "./core.js";
import { hitTargets, modeAllows } from "./shared.js";
import { inRunningCombat, canAnswerFor } from "./hold.js";
import { livePopups, popupKey, openManagedPopup, bfCard, holdBarHTML, scheduleBarSync } from "./ui.js";
import { forceStatus } from "./shared.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { messageActivity, joinEffectReceipt } from "./effect-riders.js";
import { dramaticVerdictPause } from "./concentration.js";

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

/** What each optional mastery asks, in the popup's own words. */
const MASTERY_RULES = {
  slow: "Reduce its Speed by 10 feet until the start of your next turn.",
  topple: "Force a Constitution saving throw. On a failure, it falls Prone.",
  push: "Push it up to 10 feet straight away from you.",
  graze: "The miss still deals your ability modifier in damage."
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
 * damage"). The receipt's post-trait `taken` is the truth when auto-apply ran; without a
 * receipt the roll total is the best available approximation (a target-specific immunity is
 * invisible then, and that is accepted — the alternative is recomputing traits by hand).
 */
function dealtFor(damageMessage, uuid) {
  const entry = damageMessage?.getFlag(MODULE_ID, "receipt")?.targets?.find(t => t.uuid === uuid);
  if ( entry ) return (typeof entry.taken === "number") ? entry.taken
    : -((entry.delta?.value ?? 0) + (entry.delta?.temp ?? 0));
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
    // (the hopeless-hold precedent, applied to payouts).
    const live = [];
    for ( const t of hits ) {
      const actor = await fromUuid(t.uuid);
      if ( (actor instanceof Actor) && ((actor.system.attributes?.hp?.value ?? 0) > 0) )
        live.push({ uuid: t.uuid, name: t.name, actor });
    }
    if ( !live.length ) return;

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
        // A reminder, not a payout (design.md 1.9B amendment): the extra attack, its target
        // and its rolls stay native. Once per combat turn — the option is once per turn, so
        // is the nag; out of combat every hit reminds (the test range has no turns).
        const c = game.combat;
        if ( c?.started ) {
          const stamp = `${c.id}:${c.round}:${c.turn}`;
          if ( cleaveNoticed.get(ctx.attacker.uuid) === stamp ) return;
          cleaveNoticed.set(ctx.attacker.uuid, stamp);
        }
        return postMasteryNotice(ctx, "cleave", live);
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
        return; // nick: action economy, deliberately native
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
    case "topple": return toppleCard(ctx, targets);
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
  const flag = foundry.utils.deepClone(receiptMessage?.getFlag(MODULE_ID, "effectReceipt") ?? { targets: [] });
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
    joinEffectReceipt(flag, { uuid: t.uuid, name: t.name, img: actor.img ?? null,
      effects: [{ id: applied.id, name: applied.name, img: applied.img,
        description: applied.description ?? "", reverted: false }] });
  }
  if ( flag.targets.length && receiptMessage ) await receiptMessage.setFlag(MODULE_ID, "effectReceipt", flag);
}

/** Topple: the demand, the native save link, and a GM affordance for the failure. */
async function toppleCard(ctx, targets) {
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
      weapon: { name: ctx.weapon.name, img: ctx.weapon.img },
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}),
      targets: targets.map(t => ({ uuid: t.uuid, name: t.name, done: false }))
    } } }
  });
}

/** Topple popups this client has offered (message.id|uuid), never re-popped on render. */
const shownToppleAsks = new Set();

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
  if ( !canAnswerFor(actor) ) return;
  const key = popupKey(message.id, `topple:${target.uuid}`);
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return; } // recall fronts the live popup, never a silent no-op
  let dialog;
  const roll = mode => rollToppleSave(message, target, {
    mode, bonus: dialog?.element?.querySelector('input[name="bf-topple-bonus"]')?.value ?? ""
  });
  dialog = new foundry.applications.api.DialogV2({
    window: { title: `Topple — ${target.name}`, icon: "fa-solid fa-person-falling" },
    position: { width: 440 },
    content: bfCard({
      img: topple.weapon?.img ?? null,
      eyebrow: "Weapon Mastery — Topple",
      title: `${target.name}: Constitution save, DC ${topple.dc}`,
      subtitle: `${topple.weapon?.name ?? "The weapon"} demands it — on a failure, ${target.name} falls Prone.`,
      tone: "pending"
    }) + `
    <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;">
      <label style="flex:1;font-size:var(--font-size-12,12px);">Situational Bonus</label>
      <input type="text" name="bf-topple-bonus" placeholder="e.g. 1d4" autocomplete="off"
             style="flex:1;min-width:0;text-align:center;">
    </div>` + holdBarHTML({ status: "pending", deadline: topple.deadline, window: topple.window }, "to roll"),
    buttons: [
      { action: "advantage", label: "Advantage", callback: () => roll("advantage") },
      { action: "normal", label: "Normal", default: true, callback: () => roll("normal") },
      { action: "disadvantage", label: "Disadvantage", callback: () => roll("disadvantage") }
    ],
    rejectClose: false
  });
  await openManagedPopup(key, message, dialog);
}

/** Roll one pending topple target's save, chained to the card — the fold does the rest.
 * The buzzer's press rides the same path with `timedOut`, straight and data-driven. */
async function rollToppleSave(message, target, { mode = null, bonus = null, timedOut = false } = {}) {
  const flag = message.getFlag(MODULE_ID, "topple");
  const entry = flag?.targets?.find(t => t.uuid === target.uuid);
  if ( !entry || entry.done ) return;
  const actor = await fromUuid(target.uuid);
  if ( !(actor instanceof Actor) ) return;
  const rollOverride = {};
  if ( mode === "advantage" ) rollOverride.options = { advantage: true, disadvantage: false };
  else if ( mode === "disadvantage" ) rollOverride.options = { advantage: false, disadvantage: true };
  else if ( mode === "normal" ) rollOverride.options = { advantage: false, disadvantage: false };
  const part = (bonus ?? "").trim().replace(/^\+\s*/, "");
  if ( part ) {
    if ( Roll.validate(part) ) rollOverride.parts = [part];
    else ui.notifications.warn(`${TITLE}: "${part}" is not a rollable bonus — rolling without it.`);
  }
  await actor.rollSavingThrow(
    { ability: flag.ability || "con", target: flag.dc,
      ...(Object.keys(rollOverride).length ? { rolls: [rollOverride] } : {}) },
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
  if ( toppleTimers.has(message.id) ) return;
  toppleTimers.set(message.id, setTimeout(() => {
    toppleTimers.delete(message.id);
    void fireToppleTimer(message.id);
  }, Math.max(0, flag.deadline - Date.now())));
}

function disarmToppleTimer(messageId) {
  const handle = toppleTimers.get(messageId);
  if ( handle === undefined ) return;
  clearTimeout(handle);
  toppleTimers.delete(messageId);
}

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
        const merged = foundry.utils.deepClone(card.getFlag(MODULE_ID, "topple"));
        const gone = merged.targets?.find(x => !x.done && (x.uuid === t.uuid));
        if ( gone ) {
          gone.done = true;
          gone.outcome = "gone";
          gone.applied = true; // nothing to press
          gone.answeredAt = Date.now();
          await card.setFlag(MODULE_ID, "topple", merged);
        }
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
  entry.applied = true;
  await card.setFlag(MODULE_ID, "topple", flag);
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
      entry.done = true;
      entry.outcome = success ? "saved" : "prone";
      entry.total = total;
      if ( saveMessage.getFlag(MODULE_ID, "timedOut") ) entry.timedOut = true;
      // The crash-resume contract (the saves machine's `applied` discipline): answeredAt is
      // the horizon's clock and the new-era marker; a success has no consequence to resume.
      entry.answeredAt = Date.now();
      if ( success ) entry.applied = true;
      await card.setFlag(MODULE_ID, "topple", flag);
      if ( flag.targets.every(t => t.done) ) disarmToppleTimer(card.id);
      if ( !success ) {
        await dramaticVerdictPause(saveMessage); // same instant-verdict class as the fold
        await applyToppleFailure(card, entry.uuid);
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
  vex: (ctx, names) => ({
    title: "Vex — Advantage on your next attack",
    lines: [`Against ${names}, before the end of your next turn. Claim it in the roll dialog — nothing applies it for you.`]
  }),
  sap: (ctx, names) => ({
    title: `Sap — ${names} at Disadvantage`,
    lines: [`On its next attack roll, before the start of ${ctx.attacker.name}'s next turn. The chip on the target carries the rule; the roll dialog is where it is honoured.`]
  }),
  cleave: (ctx, names) => ({
    title: "Cleave — one extra attack available",
    lines: [`One extra attack with ${ctx.weapon.name} against a second creature within 5 feet of ${names} — once on your turn, and its damage takes no ability modifier. Roll it from the sheet; nothing moves for you.`]
  })
};

/** Reminders this client has shown, so a re-render never re-pops a dismissed one. */
const shownMasteryNotices = new Set();

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
      weapon: { name: ctx.weapon.name, img: ctx.weapon.img },
      title, subtitle, lines,
      deadline: Date.now() + 15000, window: 15
    } } }
  });
}

/**
 * The reminder popup: an informational table moment — ONE control (OK) and a 15-second
 * auto-dismiss with the drain bar, because dismissal and expiry are the same non-event and
 * nothing downstream waits. Deliberately NOT a decision: the two-control rule governs
 * decisions, and a reminder has nothing to decide (design.md 1.9C amendment). Stale renders
 * never pop — the deadline gates the popup, while the card stays as the record.
 */
async function showMasteryNotice(message, notice) {
  const key = popupKey(message.id, "notice");
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return; }
  const dialog = new foundry.applications.api.DialogV2({
    window: { title: `${masteryLabel(notice.key)} — ${notice.weapon?.name ?? ""}`, icon: "fa-solid fa-medal" },
    position: { width: 420 },
    content: bfCard({
      img: notice.weapon?.img, eyebrow: `Weapon Mastery — ${masteryLabel(notice.key)}`,
      tone: "good", title: notice.title, subtitle: notice.subtitle, lines: notice.lines ?? []
    }) + holdBarHTML({ status: "pending", deadline: notice.deadline, window: notice.window }, "reminder"),
    buttons: [{ action: "ok", label: "OK", default: true }],
    rejectClose: false
  });
  setTimeout(() => { if ( livePopups.get(key) === dialog ) void dialog.close(); },
    Math.max(0, notice.deadline - Date.now()));
  await openManagedPopup(key, message, dialog);
}

/* --- the ask: stamp → row → popup → answer → execute -------------------------------------- */

/** Asks this client has already popped, so a re-render never stacks a second dialog. */
const shownMasteryAsks = new Set();
const masteryTimers = new Map();

async function stampMasteryAsk(attackMessage, damageMessage, ctx, key, targets) {
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  await attackMessage.setFlag(MODULE_ID, "mastery", {
    status: "pending", key,
    weapon: { name: ctx.weapon.name, img: ctx.weapon.img },
    attackerUuid: ctx.attacker.uuid,
    damageMessageId: damageMessage?.id ?? null,
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

Hooks.on("deleteChatMessage", message => {
  disarmMasteryTimer(message.id);
  disarmToppleTimer(message.id);
  shownMasteryAsks.delete(message.id);
  shownMasteryNotices.delete(message.id);
  for ( const key of shownToppleAsks ) if ( key.startsWith(`${message.id}|`) ) shownToppleAsks.delete(key);
});

/**
 * The elect-owned buzzer for a single-answer ask — the shape the mastery ask and the
 * concentration ask share exactly (elect owns the clock, one pending flag, one answer, expiry
 * re-checks the live flag before acting). Extracted when the third clock appeared, per the
 * standing note that used to sit here. The HOLD's clock stays its own machine on purpose:
 * a different owner (the continuing client, not the elect) and per-target answers — folding
 * it in would be the three-lambda machine the original note warned about.
 */
export function armAskTimer(timers, message, flagKey, expire) {
  const flag = message?.getFlag(MODULE_ID, flagKey);
  if ( !flag?.deadline || (flag.status !== "pending") || flag.answer || !isActiveGM() ) return;
  if ( timers.has(message.id) ) return;
  timers.set(message.id, setTimeout(async () => {
    timers.delete(message.id);
    const live = game.messages.get(message.id);
    const cur = live?.getFlag(MODULE_ID, flagKey);
    if ( !cur || (cur.status !== "pending") || cur.answer ) return;
    await expire(live);
  }, Math.max(0, flag.deadline - Date.now())));
}

export function disarmAskTimer(timers, messageId) {
  const handle = timers.get(messageId);
  if ( handle === undefined ) return;
  clearTimeout(handle);
  timers.delete(messageId);
}

/** Expiry answers Pass — the AFK fallback for a decision nobody made. */
const armMasteryTimer = message =>
  armAskTimer(masteryTimers, message, "mastery", live => answerMastery(live, "pass", { timedOut: true }));
const disarmMasteryTimer = messageId => disarmAskTimer(masteryTimers, messageId);

/** The Use/Pass popup — the same two controls for everybody, on the hold's own bar. */
async function showMasteryPopup(message, m) {
  const attacker = (() => { try { return fromUuidSync(m.attackerUuid); } catch { return null; } })();
  if ( !canAnswerFor(attacker) ) return;
  const key = popupKey(message.id, "mastery");
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return; }

  const label = masteryLabel(m.key);
  const buttons = [
    { action: "use", label: `Use ${label}`, default: true,
      callback: () => answerMastery(message, "use") },
    { action: "pass", label: "Pass",
      callback: () => answerMastery(message, "pass") }
  ];
  const dialog = new foundry.applications.api.DialogV2({
    window: { title: `${label} — ${m.weapon?.name ?? ""}`, icon: "fa-solid fa-medal" },
    position: { width: 420 },
    content: bfCard({
      img: m.weapon?.img, eyebrow: "Weapon Mastery", tone: "neutral",
      title: `${label}: use it?`,
      subtitle: `${attacker?.name ?? "The attacker"} — ${m.weapon?.name ?? "weapon"}`,
      lines: [MASTERY_RULES[m.key] ?? "", `Against: ${(m.targets ?? []).map(t => t.name).join(", ")}`]
    }) + holdBarHTML(m),
    buttons,
    rejectClose: false
  });
  await openManagedPopup(key, message, dialog);
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
        if ( !shownMasteryAsks.has(message.id) ) {
          shownMasteryAsks.add(message.id);
          void showMasteryPopup(message, m);
        }
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Answer";
        Object.assign(button.style, { width: "auto", margin: "0.25rem 0 0", padding: "0 0.6rem" });
        button.addEventListener("click", () => {
          void showMasteryPopup(message, message.getFlag(MODULE_ID, "mastery"));
        });
        row.appendChild(button);
      }
    }
  }

  // The reminder popup rides the notice card exactly as the ask popup rides its flag: the
  // deadline gates staleness (an old log render must never nag), the shown-set gates
  // re-pops, and canAnswerFor picks the client that owns the moment.
  const notice = message.getFlag(MODULE_ID, "masteryNotice");
  if ( notice ) {
    // The pairing rule (design.md §4.3, v1.10.0): while the popup's 15s drain runs for its
    // owner, the SAME bar runs on the card for the table. holdBarHTML returns "" once the
    // moment has passed, so an old log renders no bar — every client, no latch, stateless.
    if ( notice.deadline > Date.now() ) {
      const bar = document.createElement("div");
      bar.innerHTML = holdBarHTML(
        { status: "pending", deadline: notice.deadline, window: notice.window }, "reminder");
      if ( bar.innerHTML.trim() ) {
        html.querySelector(".message-content")?.appendChild(bar);
        scheduleBarSync(bar);
      }
    }
    const attacker = (() => { try { return fromUuidSync(notice.attackerUuid); } catch { return null; } })();
    if ( canAnswerFor(attacker) && (notice.deadline > Date.now())
      && !shownMasteryNotices.has(message.id) ) {
      shownMasteryNotices.add(message.id);
      void showMasteryNotice(message, notice);
    }
  }

  const topple = message.getFlag(MODULE_ID, "topple");
  if ( topple?.targets?.length ) {
    // The demand's bar, card-side (v1.10.0 — the pairing rule): drains in step with every
    // popup, and the buzzer re-arms statelessly on render (a reload resumes the clock from
    // the flag's absolute deadline, the hold timer's discipline).
    if ( topple.deadline && topple.targets.some(t => !t.done) ) {
      const bar = document.createElement("div");
      bar.innerHTML = holdBarHTML(
        { status: "pending", deadline: topple.deadline, window: topple.window }, "to roll");
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
        // The GM's unsolicited popups are non-player-owned targets only (v1.12.0,
        // finding ④ — the save machine's rule, and the topple demand is a save): a
        // player-owned target whose owner is offline rides the saveTimer buzzer; the
        // Roll button below recalls deliberately, and the GM prone button is the paper
        // backstop either way.
        const gmQuiet = game.user.isGM && !!actor?.hasPlayerOwner;
        const shownKey = `${message.id}|${t.uuid}`;
        if ( !gmQuiet && !shownToppleAsks.has(shownKey) ) {
          shownToppleAsks.add(shownKey);
          void showTopplePopup(message, topple, t);
        }
        const rollBtn = document.createElement("button");
        rollBtn.type = "button";
        rollBtn.textContent = `Roll save — ${t.name}`;
        Object.assign(rollBtn.style, { width: "auto", margin: "0.25rem 0.25rem 0 0", padding: "0 0.6rem" });
        rollBtn.addEventListener("click", () => {
          void showTopplePopup(message, message.getFlag(MODULE_ID, "topple"), t);
        });
        html.querySelector(".message-content")?.appendChild(rollBtn);
      }

      if ( game.user.isGM ) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `${t.name} failed — Prone`;
        Object.assign(button.style, { width: "auto", margin: "0.25rem 0.25rem 0 0", padding: "0 0.6rem" });
        button.addEventListener("click", async () => {
          const live = await fromUuid(t.uuid);
          if ( live instanceof Actor ) await forceStatus(live, "prone",
            { origin: message.getFlag(MODULE_ID, "topple")?.attackerUuid ?? null });
          const flag = foundry.utils.deepClone(message.getFlag(MODULE_ID, "topple"));
          const entry = flag.targets.find(x => x.uuid === t.uuid);
          if ( entry ) { entry.done = true; entry.outcome = "prone"; entry.applied = true; entry.answeredAt = Date.now(); }
          await message.setFlag(MODULE_ID, "topple", flag);
        });
        html.querySelector(".message-content")?.appendChild(button);
      }
    }
  }
});

