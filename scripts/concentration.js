/**
 * Battle Flow — Phase 2.5: the concentration assist - damage, ask, roll, verdict, break.
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, rollerUserFor, canAnswerFor,
  drivesMomentFor, canApplyTo, whisperNoGM, statContext } from "./core.js";
import { rollConfigFor } from "./shared.js";
import { popupKey, bfCard, holdBarHTML } from "./decide/present.js";
import { livePopups, openMomentPopup, momentButton,
  scheduleBarSync, shownMoments, armAskTimer, disarmAskTimer,
  dramaticVerdictPause } from "./ui.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 2.5 — the concentration assist: damage → ask → roll → verdict → break.
 *
 * The moment has NO decision in it. A concentration save is mandatory — RAW offers no decline —
 * so the popup carries exactly ONE control (Roll; the two-control rule governs decisions, and a
 * fake second choice is the Skip button again), and the timer's expiry action is the roll
 * itself, never a pass (DESIGN.md N3/§5). What the popup offers is dice agency: the save that
 * might drop the party's Bless belongs in its owner's hand.
 *
 * The chat log is the bus, as everywhere. The GM elect stamps an ASK message off
 * dnd5e.damageActor under the native prompt's exact guard — so ALL damage qualifies, whether
 * this module applied it, the native tray did, or the GM dragged a number on a sheet. The
 * owning player's client volunteers the roll (first-active-owner election, GM elect for NPCs
 * and offline owners — their character, their dice, §4.1) through rollConcentration with the
 * ask's DC as `target`, so the system's own success test marks the save card and the verdict
 * below can never disagree with it. The roll message answers the ask (the module's rolls carry
 * respondsTo; a save rolled straight from the sheet is detected like a sheet-cast answers a
 * hold — the roll is the answer, the button is convenience). The elect folds the verdict and,
 * on a failure, presses the button the system never presses itself: endConcentration, whose
 * native dependentOn cascade strips every riding effect across the table.
 *
 * Zero HP is not a save: unconscious ⇒ incapacitated ⇒ concentration simply ends (a determined
 * outcome, §2.1), and the system does NOT do this natively — verified 5.3.3, nothing links HP
 * or statuses to endConcentration. Straight to the break, no ask.
 * ------------------------------------------------------------------------------------------- */

/**
 * What last hit whom — best-effort cause enrichment for the ask card, captured on the applying
 * client at dnd5e.preApplyDamage (the one seam that still knows the originating message) and
 * read back moments later by the damageActor handler. Damage applied outside applyDamage (a
 * sheet edit) has no cause and the ask says only how much, which is the honest floor.
 * ⚠ Healing rides the same hook (roll.type "healing" — the veto ground truth), hence the
 * amount > 0 guard: a Cure Wounds must never be remembered as what "hit" someone.
 */
const recentDamageCauses = new Map();

Hooks.on("dnd5e.preApplyDamage", (actor, amount, updates, options) => {
  if ( setting(S.concMode) === "off" ) return;
  if ( !(Number(amount) > 0) || !actor?.uuid ) return;
  const message = options?.originatingMessage;
  if ( !(message instanceof ChatMessage) ) return;
  // Every usage AND damage card carries the whole messageFlags set (mixin.mjs:203/:895), so
  // the item behind the damage is one flag read; the speaker names the attacker.
  let source = null;
  try { source = fromUuidSync(message.getFlag("dnd5e", "item")?.uuid ?? "")?.name ?? null; }
  catch(err) { source = null; }
  const attacker = message.getAssociatedActor?.()?.name ?? null;
  if ( actor.concentration?.effects?.size ) {
    recentDamageCauses.set(actor.uuid, { at: Date.now(), source, attacker });
  }
});

function takeRecentCause(actorUuid) {
  const cause = recentDamageCauses.get(actorUuid);
  recentDamageCauses.delete(actorUuid);
  if ( !cause || ((Date.now() - cause.at) > 3000) ) return null;
  return (cause.source || cause.attacker) ? { source: cause.source, attacker: cause.attacker } : null;
}

/** What the actor is concentrating on, by name — the system's own fallback chain. */
function concentratingOn(actor) {
  return [...(actor?.concentration?.effects ?? [])].map(e => {
    const data = e.getFlag("dnd5e", "item");
    return data?.name ?? actor.items.get(data?.id)?.name ?? e.name;
  });
}

/**
 * The trigger. Mirrors the native prompt's guard exactly (attributes.mjs:548-551): a net HP
 * loss where either temp went down or the pool sits below its effective max — the case that
 * excludes is an hp.value drop caused by a max-HP reduction, which is not damage. Rest and
 * advancement never reach this hook at all (onUpdateHP returns before firing it). The one
 * native nicety not visible here is options.dnd5e.concentrationCheck === false (an API
 * courtesy no system code sets); a module opting out of the native prompt still gets ours.
 */
Hooks.on("dnd5e.damageActor", (actor, changes) => {
  if ( setting(S.concMode) === "off" ) return;
  // ⚠ WITH NO GM, THE CONCENTRATOR'S OWN CLIENT STAMPS IT (v1.27.2). This is the machine that
  // loses least when the GM drops: the subject is almost always a PC, so the ask card, the
  // save, and even the consequence (ending concentration is a write to their OWN sheet) are
  // all things that player may do. Gated on the SUBJECT rather than the room, so two players
  // taking damage in the same tick each drive only their own ask.
  if ( !drivesMomentFor(actor?.uuid) ) return;              // single writer stamps the ask
  if ( !(actor instanceof Actor) ) return;
  if ( !actor.concentration?.effects?.size ) return;
  const hp = actor.system.attributes?.hp;
  if ( !hp ) return;
  if ( !((changes.temp < 0) || (hp.value < hp.effectiveMax)) ) return;
  void stampConcentrationAsk(actor, changes);
});

/** The concentration ability exactly as rollConcentration will resolve it (actor.mjs:1728). */
function concAbility(actor) {
  const conc = actor.system.attributes?.concentration;
  return (conc?.ability in CONFIG.DND5E.abilities) ? conc.ability
    : CONFIG.DND5E.defaultAbilities.concentration;
}

const concRecipients = actor => [...new Set(game.users
  .filter(u => u.isGM || actor?.testUserPermission?.(u, "OWNER")).map(u => u.id))];

async function stampConcentrationAsk(actor, changes) {
  const damage = -changes.total;
  const names = concentratingOn(actor);

  // Zero HP is not a save (see the section banner). The concentrator is down; end it.
  if ( (actor.system.attributes.hp.value ?? 0) <= 0 ) {
    await breakConcentration(actor, { names, reason: "down" });
    return;
  }

  const dc = actor.getConcentrationDC(damage);              // the system's clamp(half, 10, 30)
  const cause = takeRecentCause(actor.uuid);
  const window = Math.max(0, Number(setting(S.concTimer)) || 0);
  const abilityLabel = CONFIG.DND5E.abilities[concAbility(actor)]?.label ?? "Constitution";

  await ChatMessage.create({
    content: bfCard({
      img: actor.img ?? null,
      eyebrow: "Concentration check",
      title: `${abilityLabel} save, DC ${dc}`,
      subtitle: `${actor.name} — concentrating on ${names.join(", ") || "a spell"}`,
      lines: [causeLine(cause, damage)],
      tone: "pending"
    }),
    speaker: ChatMessage.getSpeaker({ actor }),
    ...(setting(S.concVisibility) ? {} : { whisper: concRecipients(actor) }),
    flags: { [MODULE_ID]: { concentration: {
      status: "pending",
      actorUuid: actor.uuid,
      actorName: actor.name,
      // The data-plane stamp. Source = the CONCENTRATOR (whose check this is; the flag's own
      // actor, the d20fold semantics) — the damage's dealer is `cause`, recorded by name only.
      ...statContext(actor.uuid),
      ability: concAbility(actor),
      dc, damage, names,
      // Which effects were at stake, snapshotted now: the break ends exactly these, and
      // endConcentration tolerates one already gone (the spell may end while the save is
      // in the air).
      effectIds: [...actor.concentration.effects].map(e => e.id),
      ...(cause ? { cause } : {}),
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
    } } }
  });
}

/** "Took 12 damage from Morgash's Greatsword." — with whatever parts the cause actually has. */
function causeLine(cause, damage) {
  let from = "";
  if ( cause?.attacker && cause?.source && (cause.attacker !== cause.source) ) {
    from = ` from ${cause.attacker}'s ${cause.source}`;
  } else if ( cause?.source ?? cause?.attacker ) {
    from = ` from ${cause.source ?? cause.attacker}`;
  }
  return `Took <strong>${damage}</strong> damage${from}.`;
}

/** Same-client re-entry latch (render resume + create watcher can volunteer in one tick). */
const concRollsInFlight = new Set();

/**
 * Roll the save that answers an ask. The DC rides as `target`, so the system's own success
 * test (basic-roll.mjs:221) marks the save card; the dialog is always skipped
 * (configure: false) because the POPUP is the configuration surface — it carries the native
 * dialog's own controls (situational bonus, Advantage/Normal/Disadvantage; user call
 * 2026-08-16, "since it's so important to players"), delivered here as `mode` and `bonus`.
 * The buzzer and auto mode pass neither: a straight data-driven roll, where sheet-borne
 * modifiers (War Caster's advantage via concentration.roll.mode, save bonuses) still apply
 * themselves — only the ad-hoc inputs expire with the timer.
 *
 * The mode is forced through the roll's own advantage/disadvantage booleans — exactly the
 * pair applyKeybindings resolves into advantageMode (d20-roll.mjs:96), which it recomputes
 * unconditionally, so setting advantageMode directly would be overwritten. mergeConfigs lets
 * an explicit boolean override the data-driven one (basic-roll.mjs:465), which is precisely
 * how clicking Normal on the native dialog out-votes War Caster for one roll.
 */
async function rollConcentrationAnswer(askMessage, { timedOut = false, mode = null, bonus = null } = {}) {
  if ( concRollsInFlight.has(askMessage.id) ) return;
  concRollsInFlight.add(askMessage.id);
  try {
    const ask = askMessage.getFlag(MODULE_ID, "concentration");
    if ( !ask || (ask.status !== "pending") ) return;
    // An answer that already landed wins, even though the ask still reads pending — the fold
    // is the elect's job and may not have caught up. Whole-log by flag, never a tail window.
    // Closes the re-render double-roll: the flag flips to done only after the fold, and the
    // in-flight latch above cannot see across that gap.
    if ( game.messages.some(m => m.getFlag(MODULE_ID, "respondsTo") === askMessage.id) ) return;
    const actor = await fromUuid(ask.actorUuid);
    if ( !(actor instanceof Actor) || !actor.isOwner ) return;
    await actor.rollConcentration(
      { target: ask.dc,
        ...rollConfigFor(mode, bonus) },
      { configure: false },
      {
        data: { flags: { [MODULE_ID]: {
          // The hold's answer-channel key, reused with the same meaning: this message
          // answers that one. The hold's own watcher no-ops on it (no hold flag there).
          respondsTo: askMessage.id,
          ...(timedOut ? { timedOut: true } : {})
        } } },
        ...(setting(S.concVisibility) ? {} : { rollMode: CONST.DICE_ROLL_MODES.PRIVATE })
      }
    );
  } catch(err) {
    console.error(`${TITLE} | Concentration roll failed — roll it from the sheet.`, err);
  } finally {
    concRollsInFlight.delete(askMessage.id);
  }
}

/** Every still-pending ask for one actor, oldest first — the popup queue and the fold order. */
function pendingConcAsks(actorUuid) {
  return game.messages
    .filter(m => {
      const c = m.getFlag(MODULE_ID, "concentration");
      return c && (c.status === "pending") && (c.actorUuid === actorUuid);
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Which pending ask a message answers, if any: the module's own respondsTo stamp, or a bare
 * sheet-rolled save matching a pending ask's actor and ability — no originatingMessage,
 * because a save belonging to an activity chain (a spell's save, Phase 2's territory) must
 * never be mistaken for a concentration answer.
 */
function concAskAnsweredBy(message) {
  const respondsTo = message.getFlag(MODULE_ID, "respondsTo");
  if ( respondsTo ) {
    return game.messages.get(respondsTo)?.getFlag(MODULE_ID, "concentration") ? respondsTo : null;
  }
  const roll = message.getFlag("dnd5e", "roll");
  if ( roll?.type !== "save" ) return null;
  if ( message.getFlag("dnd5e", "originatingMessage") ) return null;
  const actor = message.getAssociatedActor?.();
  if ( !actor ) return null;
  const oldest = pendingConcAsks(actor.uuid)[0];
  if ( !oldest ) return null;
  if ( (roll.ability ?? null) !== oldest.getFlag(MODULE_ID, "concentration").ability ) return null;
  return oldest.id;
}

/** Same-client fold latch — the create watcher and the render resume can race in one tick. */
const concFolds = new Set();

/**
 * The elect folds a roll into its ask and acts on the verdict. Success is the ask's DC against
 * the roll total — the ask is the authority, not the roll's own target: a sheet-rolled save
 * carries rollConcentration's default target of 10, and 12 vs a DC 14 ask must break. (The
 * system's test is total >= target with no nat-1/nat-20 override on saves at 5.3.3, so the
 * module-rolled card and this verdict are always the same fact.)
 */
async function foldConcentrationRoll(askMessage, rollMessage) {
  if ( !askMessage || concFolds.has(askMessage.id) ) return;
  concFolds.add(askMessage.id);
  try {
    const ask = foundry.utils.deepClone(askMessage.getFlag(MODULE_ID, "concentration") ?? {});
    if ( ask.status !== "pending" ) return;
    const roll = rollMessage.rolls?.[0];
    if ( !roll ) return;

    const actor = await fromUuid(ask.actorUuid);
    // Freeze the visibility choice AT VERDICT TIME — the pause below must not let a
    // setting flip re-address the announcement (bit smoke-conc 10c the day the pause
    // landed: the suite restored visibility while the dice were still tumbling). Stored on
    // the outcome so a crash-resume announces to the same ears.
    const whisper = setting(S.concVisibility) ? null : concRecipients(actor);

    ask.status = "done";
    ask.outcome = {
      total: roll.total,
      success: roll.total >= ask.dc,
      ...(rollMessage.getFlag(MODULE_ID, "timedOut") ? { timedOut: true } : {}),
      rollMessageId: rollMessage.id,
      // The crash-resume contract (the saves machine's `applied` discipline): the
      // consequence sets `applied` when it finishes, and a done-but-unapplied outcome older
      // than the resume horizon gets re-driven by any GM render. answeredAt is both the
      // horizon's clock and the new-era marker — an outcome without it predates this
      // contract and stays untouched history.
      answeredAt: Date.now(),
      ...(whisper ? { whisperIds: whisper } : {})
    };
    disarmAskTimer(concTimers, askMessage.id);
    await askMessage.setFlag(MODULE_ID, "concentration", ask);

    // Claimed above; now let the dice land before the drama (the icons stripping mid-roll
    // was the report — the row's verdict text updating early is accepted).
    await dramaticVerdictPause(rollMessage);

    if ( ask.outcome.success ) {
      // "Holds" is only true while there is something held — the spell may have ended by
      // itself (duration, a manual right-click) while the save was in the air.
      if ( actor?.concentration?.effects?.size ) await announceConcentrationHolds(actor, ask, whisper);
    } else {
      await breakConcentration(actor, { names: ask.names, effectIds: ask.effectIds, ask });
    }
    await markConcApplied(askMessage);
  } finally {
    concFolds.delete(askMessage.id);
  }
}

/** The consequence finished — write the resume contract's receipt. */
async function markConcApplied(askMessage) {
  const live = game.messages.get(askMessage.id);
  const cur = foundry.utils.deepClone(live?.getFlag(MODULE_ID, "concentration") ?? null);
  if ( !cur?.outcome || cur.outcome.applied ) return;
  cur.outcome.applied = true;
  await live.setFlag(MODULE_ID, "concentration", cur);
}

/** Same-client latch for the crash-resume below. */
const concResumes = new Set();

/**
 * Crash-resume: the fold flipped the flag to done, then its client died inside the verdict
 * pause — the cascade and the break card never happened, and nothing would ever re-drive
 * them (the done status is exactly what every other path checks before acting). Any GM
 * render re-drives a done-but-unapplied outcome once it is stale enough that no live fold
 * can still be inside its pause. Idempotent: endConcentration on already-gone effects
 * no-ops into its catch, and the announcement re-posts — a duplicate card after a real
 * crash is self-explaining, where silence was the bug.
 */
async function resumeConcOutcome(askMessage) {
  if ( concResumes.has(askMessage.id) ) return;
  concResumes.add(askMessage.id);
  try {
    const ask = foundry.utils.deepClone(askMessage.getFlag(MODULE_ID, "concentration") ?? {});
    if ( (ask.status !== "done") || !ask.outcome?.answeredAt || ask.outcome.applied ) return;
    const actor = await fromUuid(ask.actorUuid);
    const whisper = ask.outcome.whisperIds ?? null;
    if ( ask.outcome.success ) {
      if ( actor?.concentration?.effects?.size ) await announceConcentrationHolds(actor, ask, whisper);
    } else {
      await breakConcentration(actor, { names: ask.names, effectIds: ask.effectIds, ask });
    }
    await markConcApplied(askMessage);
  } catch(err) {
    console.error(`${TITLE} | Concentration outcome resume failed.`, err);
  } finally {
    concResumes.delete(askMessage.id);
  }
}

/** Quiet good news — one line, visibility-scoped (announce by stakes, ARCHITECTURE.md §6).
 * `whisper` is decided by the caller AT VERDICT TIME, before the dramatic pause. */
async function announceConcentrationHolds(actor, ask, whisper = null) {
  await ChatMessage.create({
    content: bfCard({
      img: actor?.img ?? null,
      eyebrow: "Concentration",
      title: `${ask.names?.join(", ") || "Concentration"} holds`,
      subtitle: `${ask.outcome.total} vs DC ${ask.dc}`
        + `${ask.outcome.timedOut ? " — rolled by the timer" : ""}`,
      tone: "good"
    }),
    speaker: { alias: TITLE },
    ...(whisper ? { whisper } : {})
  });
}

/**
 * End concentration the way the system would — endConcentration → effect.delete → the native
 * dependentOn cascade strips every riding effect on every actor — and say so LOUDLY, always
 * in public: the cascade just removed icons across the whole table, and an icon vanishing
 * must never be a mystery (DESIGN.md R5). With Failure Breaks Concentration off, this
 * announces and leaves the ending to the GM.
 */
async function breakConcentration(actor, { names = [], effectIds = null, ask = null, reason = null } = {}) {
  const breaks = setting(S.concBreak);
  // ⚠ ENDING CONCENTRATION IS A WRITE TO THE CONCENTRATOR (v1.27.2). For a PC that is their
  // OWN sheet, so with no GM the player breaks their own concentration and nothing is lost —
  // this machine degrades further than any other. An NPC concentrator is the exception: the
  // card still announces the break publicly, and the driver is told the effect is still on.
  const blocked = breaks && (actor instanceof Actor) && !canApplyTo(actor);
  if ( breaks && (actor instanceof Actor) && !blocked ) {
    const targets = effectIds ?? [...(actor.concentration?.effects ?? [])].map(e => e.id);
    for ( const id of targets ) {
      try { await actor.endConcentration(id); }
      catch(err) { console.error(`${TITLE} | Could not end concentration.`, err); }
    }
  }
  if ( blocked ) {
    await whisperNoGM(`the end of ${actor.name}'s concentration`,
      "The save and its verdict stand — end the effect from their sheet.");
  }
  const what = names.length ? names.join(", ") : "concentration";
  await ChatMessage.create({
    content: bfCard({
      img: actor?.img ?? null,
      eyebrow: "Concentration broken",
      title: `${what} ends`,
      subtitle: reason === "down"
        ? `${actor?.name ?? "The concentrator"} is down — no save at 0 HP`
        : ask ? `${ask.outcome.total} vs DC ${ask.dc} — ${actor?.name ?? "the concentrator"} loses concentration`
        : `${actor?.name ?? "The concentrator"} loses concentration`,
      lines: breaks ? [] : [`<em>Breaking is off — end it from ${actor?.name ?? "the actor"}'s effects yourself.</em>`],
      tone: "bad"
    }),
    speaker: { alias: TITLE }
  });
}

/* --- the ask's clock, answer channel, and views -------------------------------------------- */

const concTimers = new Map();

/**
 * Expiry ROLLS — the save always happens; the timer only decides who pressed the button. The
 * buzzer re-checks for an answer that already landed (an unfolded roll must beat the clock,
 * not race it), then rolls on the elect, who owns everything.
 */
const armConcTimer = message => armAskTimer(concTimers, message, "concentration", fireConcTimer);

async function fireConcTimer(askMessage) {
  const landed = game.messages.find(m => m.getFlag(MODULE_ID, "respondsTo") === askMessage.id);
  if ( landed ) return foldConcentrationRoll(askMessage, landed);
  const ask = askMessage.getFlag(MODULE_ID, "concentration");
  const actor = await fromUuid(ask?.actorUuid ?? "");
  if ( !(actor instanceof Actor) ) {
    // The concentrator no longer exists; there is nothing to roll and nothing to break.
    const gone = foundry.utils.deepClone(ask ?? {});
    gone.status = "done";
    gone.outcome = { voided: true };
    await askMessage.setFlag(MODULE_ID, "concentration", gone);
    return;
  }
  await rollConcentrationAnswer(askMessage, { timedOut: true });
}

// The answer channel: the elect folds any roll that answers an ask — the module's own stamped
// rolls and bare sheet-rolls alike. Everyone else's client just watches the flags change.
Hooks.on("createChatMessage", message => {
  {
    // The fold is driven by whoever drives THAT ask's subject (v1.27.2), resolved from the ask
    // itself — this hook sees only the answering roll, so the subject has to be looked up.
    const askId = concAskAnsweredBy(message);
    const askMsg = askId ? game.messages.get(askId) : null;
    const subject = askMsg?.getFlag(MODULE_ID, "concentration")?.actorUuid ?? null;
    if ( askMsg && drivesMomentFor(subject) ) void foldConcentrationRoll(askMsg, message);
  }
  // A fresh ask: arm the clock (elect-gated inside), and in auto mode the elected roller
  // volunteers — their character, their dice, no popup.
  const ask = message.getFlag(MODULE_ID, "concentration");
  if ( ask?.status === "pending" ) {
    armConcTimer(message);
    if ( setting(S.concMode) === "auto" ) void autoRollConcentration(message);
  }
});

async function autoRollConcentration(askMessage) {
  const ask = askMessage.getFlag(MODULE_ID, "concentration");
  const actor = await fromUuid(ask?.actorUuid ?? "");
  if ( !(actor instanceof Actor) ) return;
  if ( !(rollerUserFor(actor)?.isSelf ?? false) ) return;
  await rollConcentrationAnswer(askMessage);
}

// Every client closes a resolved ask's popup; the queue advances to the actor's next pending
// ask by nudging its render, which re-offers the popup on whichever client owns it.
Hooks.on("updateChatMessage", message => {
  const ask = message.getFlag(MODULE_ID, "concentration");
  if ( !ask ) return;
  const dialog = livePopups.get(popupKey(message.id, "concentration"));
  if ( dialog && (ask.status !== "pending") ) void dialog.close();
  if ( ask.status !== "pending" ) {
    disarmAskTimer(concTimers, message.id);
    const next = pendingConcAsks(ask.actorUuid)[0];
    if ( next ) {
      shownMoments.delete(popupKey(next.id, "concentration"));
      try { ui.chat?.updateMessage?.(next); } catch(err) { /* row refreshes next render */ }
    }
  }
});

// The shown-latch rides ui.js's one delete-sweep; only this machine's clock disarms here.
Hooks.on("deleteChatMessage", message => {
  disarmAskTimer(concTimers, message.id);
});

/**
 * The ask's row: pending = the draining bar plus a Roll control for whoever may answer
 * (prompt mode recalls the popup — one input surface; auto mode needs no control at all);
 * done = the outcome in one line. Stateless like every render hook here, with the same resume
 * discipline as the hold and the mastery ask: a pending ask re-arms its clock, an answered-
 * but-unfolded ask gets folded by the elect, and auto mode re-volunteers the roller.
 */
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const ask = message.getFlag(MODULE_ID, "concentration");
  if ( !ask ) return;

  // The crash-resume: done-but-unapplied, stale past any live pause, new-era stamps only
  // (answeredAt is the marker — pre-contract history stays history).
  if ( (ask.status === "done") && ask.outcome?.answeredAt && !ask.outcome.applied
    && drivesMomentFor(ask.actorUuid) && (Date.now() - ask.outcome.answeredAt > 20_000) ) void resumeConcOutcome(message);

  const row = document.createElement("div");
  row.className = "battleflow-concentration";

  if ( ask.status === "pending" ) {
    row.innerHTML = holdBarHTML(ask, "to roll");
    scheduleBarSync(row);
    armConcTimer(message);

    // Resume: an answer landed while nobody could fold it (the elect reloaded between the
    // roll message and the fold). Whole-log by flag — never a tail window.
    if ( drivesMomentFor(ask.actorUuid) ) {
      const landed = game.messages.find(m => m.getFlag(MODULE_ID, "respondsTo") === message.id);
      if ( landed ) void foldConcentrationRoll(message, landed);
    }
    if ( setting(S.concMode) === "auto" ) void autoRollConcentration(message);

    const actor = (() => { try { return fromUuidSync(ask.actorUuid); } catch(err) { return null; } })();
    if ( (setting(S.concMode) === "prompt") && canAnswerFor(actor) ) {
      // Auto-show only for the OLDEST pending ask (multiple damage instances queue rather
      // than stack popups); the button recalls this ask's popup regardless.
      const shownKey = popupKey(message.id, "concentration");
      if ( pendingConcAsks(ask.actorUuid)[0]?.id === message.id && !shownMoments.has(shownKey) ) {
        shownMoments.add(shownKey);
        void showConcPopup(message, message.getFlag(MODULE_ID, "concentration"));
      }
      row.appendChild(momentButton("Roll", () => {
        shownMoments.delete(shownKey);
        void showConcPopup(message, message.getFlag(MODULE_ID, "concentration"));
      }, { margin: "0.25rem 0 0" }));
    }
  } else {
    const o = ask.outcome ?? {};
    const line = document.createElement("div");
    line.textContent = o.voided ? "The concentrator is gone — nothing to roll."
      : `${o.total} vs DC ${ask.dc} — ${o.success ? "holds" : "broken"}${o.timedOut ? " (timer)" : ""}`;
    Object.assign(line.style, {
      marginTop: "0.3rem", fontSize: "var(--font-size-11, 11px)",
      fontWeight: "bold", opacity: "0.8"
    });
    row.appendChild(line);
  }
  html.querySelector(".message-content")?.appendChild(row);
});

/**
 * The popup — the ask's story over the native roll dialog's own controls: a situational
 * bonus field and the Advantage/Normal/Disadvantage buttons, in the system's design language
 * (user call, 2026-08-16 — a save this important gets the full surface, not a bare
 * confirm). Every button is the same answer, roll, so this is still not a decision; the
 * default button is hinted from actor data exactly as the native dialog hints it
 * (_prepareButtonsContext, d20-configuration-dialog.mjs:29 — War Caster pre-selects
 * Advantage). Dismissing is not an answer: the card keeps the bar and the Roll control, and
 * the buzzer rolls regardless — without any of these inputs.
 */
async function showConcPopup(message, ask) {
  if ( !ask || (ask.status !== "pending") ) return;
  const actor = (() => { try { return fromUuidSync(ask.actorUuid); } catch(err) { return null; } })();

  const abilityLabel = CONFIG.DND5E.abilities[ask.ability]?.label ?? "Constitution";
  const ADV = CONFIG.Dice.D20Roll.ADV_MODE;
  const dataMode = actor?.system?.attributes?.concentration?.roll?.mode ?? ADV.NORMAL;
  const def = (dataMode === ADV.ADVANTAGE) ? "advantage"
    : (dataMode === ADV.DISADVANTAGE) ? "disadvantage" : "normal";

  let dialog;
  const roll = mode => rollConcentrationAnswer(message, {
    mode, bonus: dialog?.element?.querySelector('input[name="bf-conc-bonus"]')?.value ?? ""
  });
  dialog = await openMomentPopup(message, "concentration", actor, {
    title: `Concentration — ${ask.names?.join(", ") || ask.actorName}`,
    icon: "fa-solid fa-brain",
    content: bfCard({
      img: actor?.img ?? null,
      eyebrow: "Concentration check",
      title: `${abilityLabel} save, DC ${ask.dc}`,
      subtitle: `${ask.actorName} — concentrating on ${ask.names?.join(", ") || "a spell"}`,
      lines: [
        causeLine(ask.cause, ask.damage),
        `A failed save ends <strong>${ask.names?.join(", ") || "the spell"}</strong>`
          + `${setting(S.concBreak) ? "" : " (breaking is off — the GM ends it by hand)"}.`
      ],
      tone: "pending"
    }) + `
    <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;">
      <label style="flex:1;font-size:var(--font-size-12,12px);">Situational Bonus</label>
      <input type="text" name="bf-conc-bonus" placeholder="e.g. 1d4" autocomplete="off"
             style="flex:1;min-width:0;text-align:center;">
    </div>` + holdBarHTML(ask, "to roll"),
    buttons: [
      { action: "advantage", label: "Advantage", default: def === "advantage",
        callback: () => roll("advantage") },
      { action: "normal", label: "Normal", default: def === "normal",
        callback: () => roll("normal") },
      { action: "disadvantage", label: "Disadvantage", default: def === "disadvantage",
        callback: () => roll("disadvantage") }
    ]
  });
}

/**
 * The native concentration prompt (challengeConcentration's whispered roll-request card) is
 * this feature's moment while the mode is on — a stale roll button under an automated flow is
 * the attack-card spam again. Vetoed on the creating client, and ONLY while an active GM
 * exists to stamp asks: a GM-less table degrades to native behavior, not to silence. A GM's
 * own [[/concentration]] enricher request is safe — message content stores the raw enricher
 * text (enrichment happens at render), never this rendered dataset markup.
 */
Hooks.on("preCreateChatMessage", doc => {
  if ( setting(S.concMode) === "off" ) return;
  if ( !game.users.activeGM ) return;
  if ( !doc.whisper?.length || doc.rolls?.length ) return;
  if ( !doc.content?.includes('data-action="concentration"') ) return;
  return false;
});

