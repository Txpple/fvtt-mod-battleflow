/**
 * Battle Flow — the concentration assist (a machine, ARCHITECTURE.md §7): damage → ask → roll →
 * verdict → break. The save is mandatory, so the popup has one answer (roll) and the clock's
 * expiry rolls rather than passes. The ask is stamped off `dnd5e.damageActor` for ALL damage; the
 * concentrator's driver rolls with the ask's DC as `target`, and a failure presses
 * `endConcentration`, whose `dependentOn` cascade strips every riding effect.
 * ⚠ dnd5e never ends concentration at 0 HP or on Incapacitated; this machine does (no save).
 */
import { MODULE_ID, TITLE, S, setting, rollerUserFor, canAnswerFor,
  drivesMomentFor, canApplyTo, whisperNoGM, statContext } from "./core.js";
import { cardItem, featureNamed, lower, resolveUuid } from "./lookup.js";
import { rollConfigFor } from "./shared.js";
import { fightingStyleEntries, listedNames } from "./settings.js";
import { FIGHTING_STYLES } from "./decide/registry.js";
import { popupKey, bfCard, esc, holdBarHTML } from "./decide/present.js";
import { livePopups, momentButton, DialogCarried, scheduleBarSync, shownMoments, armAskTimer, disarmAskTimer, dramaticVerdictPause, registerDemand, demandAnsweredBy,
  registerWithheld, withholds } from "./ui.js";
import { SAVE_FOLDS, foldedSave, foldsFrom } from "./decide/verdict.js";
import { SURFACES } from "./surfaces.js";
import { isConcentrationPrompt } from "./decide/card.js";

/**
 * What last hit whom — best-effort cause for the ask card, captured at dnd5e.preApplyDamage (the
 * one seam that knows the originating message). A sheet edit has no cause. ⚠ Healing rides the
 * same hook, hence the amount > 0 guard.
 */
const recentDamageCauses = new Map();

/**
 * The GM-private roll mode, by Foundry 14's own id. ⚠ `CONST.DICE_ROLL_MODES.PRIVATE` still reads
 * "gmroll", which dnd5e hands to `ChatMessage.create` as `messageMode` — an unknown id there
 * makes the roll PUBLIC (NOTES §2).
 */
const PRIVATE_ROLL_MODE = "gm";

Hooks.on("dnd5e.preApplyDamage", (actor, amount, _updates, options) => {
  if ( setting(S.concMode) === "off" ) return;
  if ( !(Number(amount) > 0) || !actor?.uuid ) return;
  const message = options?.originatingMessage;
  if ( !(message instanceof ChatMessage) ) return;
  // The card names its item (so a used-up item still names itself); the speaker the attacker.
  const source = cardItem(message)?.name ?? null;
  const dealer = message.getAssociatedActor?.() ?? null;
  const attacker = dealer?.name ?? null;
  if ( actor.concentration?.effects?.size ) {
    recentDamageCauses.set(actor.uuid, { at: Date.now(), source, attacker, dealerUuid: dealer?.uuid ?? null });
  }
});

function takeRecentCause(actorUuid) {
  const cause = recentDamageCauses.get(actorUuid);
  recentDamageCauses.delete(actorUuid);
  if ( !cause || ((Date.now() - cause.at) > 3000) ) return null;
  return (cause.source || cause.attacker)
    ? { source: cause.source, attacker: cause.attacker, ...(cause.dealerUuid ? { dealerUuid: cause.dealerUuid } : {}) } : null;
}

/**
 * The concentration BREAKER (Mage Slayer — RULINGS *The PHB feats — groups 4–6*): the damage's
 * dealer holds a listed FIGHTING_STYLES row that `breaks` concentration, so every roll of the ask
 * carries Disadvantage, netted by dnd5e with the concentrator's own Advantage.
 * @param {Actor|null} concentrator
 * @param {string|null} dealerUuid
 * @returns {{feat: string, by: string, uuid: string, rule: string}|null}
 */
function breakerFor(concentrator, dealerUuid) {
  if ( !dealerUuid || (dealerUuid === concentrator?.uuid) ) return null;
  const dealer = resolveUuid(dealerUuid);
  if ( !(dealer instanceof Actor) ) return null;
  const listed = listedNames(fightingStyleEntries());
  for ( const [name, row] of Object.entries(FIGHTING_STYLES) ) {
    if ( (row.breaks !== "concentration") || !listed.has(lower(name)) ) continue;
    if ( featureNamed(dealer, name) ) return { feat: name, by: dealer.name, uuid: dealer.uuid, rule: row.rule };
  }
  return null;
}

/** The roll's own Disadvantage when a breaker stands. ⚠ `disadvantage` alone, never
 * `advantage: false`, which would out-vote War Caster instead of netting with it. */
const breakerRolls = ask => ask?.breaker ? { rolls: [{ options: { disadvantage: true } }] } : {};

/** What the actor is concentrating on, by name — the system's own fallback chain. */
function concentratingOn(actor) {
  return [...(actor?.concentration?.effects ?? [])].map(e => {
    const data = e.getFlag("dnd5e", "item");
    return data?.name ?? actor.items.get(data?.id)?.name ?? e.name;
  });
}

/**
 * The trigger. Mirrors the native prompt's guard (attributes.mjs): a net HP loss where temp went
 * down or the pool sits below its effective max — a max-HP reduction is not damage.
 */
Hooks.on("dnd5e.damageActor", (actor, changes) => {
  if ( setting(S.concMode) === "off" ) return;
  // Gated on the SUBJECT: with no GM the concentrator's own client stamps, rolls and breaks.
  if ( !drivesMomentFor(actor?.uuid) ) return;              // single writer stamps the ask
  if ( !(actor instanceof Actor) ) return;
  if ( !actor.concentration?.effects?.size ) return;
  const hp = actor.system.attributes?.hp;
  if ( !hp ) return;
  if ( !((changes.temp < 0) || (hp.value < hp.effectiveMax)) ) return;
  void stampConcentrationAsk(actor, changes);
});

/* --- Incapacitated breaks concentration — no save (the glossary: "Your Concentration is broken").
 * dnd5e does not end it when the status lands; this breaks off the effect that brought it. */

function breakOnIncapacitated(effect) {
  try {
    if ( setting(S.concMode) === "off" ) return;
    if ( effect?.disabled || !effect?.statuses?.has?.("incapacitated") ) return;
    const actor = effect.parent;
    if ( !(actor instanceof Actor) || !actor.concentration?.effects?.size ) return;
    if ( !drivesMomentFor(actor.uuid) ) return;
    void breakConcentration(actor, { names: concentratingOn(actor), reason: "incapacitated" });
  } catch(err) {
    console.error(`${TITLE} | Incapacitated concentration break failed.`, err);
  }
}
Hooks.on("createActiveEffect", effect => breakOnIncapacitated(effect));
Hooks.on("updateActiveEffect", (effect, changes) => { if ( changes?.disabled === false ) breakOnIncapacitated(effect); });

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

  if ( (actor.system.attributes.hp.value ?? 0) <= 0 ) {
    await breakConcentration(actor, { names, reason: "down" });
    return;
  }

  const dc = actor.getConcentrationDC(damage);              // the system's clamp(half, 10, 30)
  const cause = takeRecentCause(actor.uuid);
  const breaker = breakerFor(actor, cause?.dealerUuid ?? null);
  const window = Math.max(0, Number(setting(S.concTimer)) || 0);
  const abilityLabel = CONFIG.DND5E.abilities[concAbility(actor)]?.label ?? "Constitution";

  await ChatMessage.create({
    content: bfCard({
      img: actor.img ?? null,
      eyebrow: "Concentration check",
      title: `${abilityLabel} save, DC ${dc}`,
      subtitle: `${actor.name} — concentrating on ${names.join(", ") || "a spell"}`,
      lines: [causeLine(cause, damage), ...(breaker ? [breakerLine(breaker)] : [])],
      tone: "pending"
    }),
    speaker: ChatMessage.getSpeaker({ actor }),
    ...(setting(S.concVisibility) ? {} : { whisper: concRecipients(actor) }),
    flags: { [MODULE_ID]: { concentration: {
      status: "pending",
      actorUuid: actor.uuid,
      actorName: actor.name,
      // The stat stamp's source is the CONCENTRATOR; the damage's dealer is `cause`.
      ...statContext(actor.uuid),
      ability: concAbility(actor),
      dc, damage, names,
      // The effects at stake, snapshotted: the break ends exactly these.
      effectIds: [...actor.concentration.effects].map(e => e.id),
      ...(cause ? { cause } : {}),
      ...(breaker ? { breaker } : {}),
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
    } } }
  });
}

/** "Mage Slayer (Morgash) — the save is made at Disadvantage." */
const breakerLine = breaker => `<strong>${esc(breaker.feat)}</strong> (${esc(breaker.by)}) — the save is made at Disadvantage.`;

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
 * Roll the save that answers an ask, with no dialog. The DC rides as `target`, so the system
 * marks the save card. The buzzer and auto mode pass no `mode`/`bonus`: a straight roll where
 * sheet modifiers (War Caster) still apply.
 * ⚠ The mode goes through the advantage/disadvantage booleans: dnd5e recomputes `advantageMode`
 * from them, so setting it directly is overwritten.
 */
async function rollConcentrationAnswer(askMessage, { timedOut = false, mode = null, bonus = null } = {}) {
  if ( concRollsInFlight.has(askMessage.id) ) return;
  concRollsInFlight.add(askMessage.id);
  try {
    const ask = askMessage.getFlag(MODULE_ID, "concentration");
    if ( !ask || (ask.status !== "pending") ) return;
    // ⚠ An answer that already landed wins though the ask still reads pending (the fold may lag);
    // whole-log by flag, never a tail window. Closes the re-render double roll.
    if ( game.messages.some(m => m.getFlag(MODULE_ID, "respondsTo") === askMessage.id) ) return;
    const actor = await fromUuid(ask.actorUuid);
    if ( !(actor instanceof Actor) || !actor.isOwner ) return;
    // A breaker's Disadvantage rides the straight roll too, unless a mode was pressed.
    const config = rollConfigFor(mode, bonus);
    if ( ask.breaker && !mode ) {
      config.rolls ??= [{}];
      config.rolls[0].options = { ...(config.rolls[0].options ?? {}), disadvantage: true };
    }
    await actor.rollConcentration(
      { target: ask.dc,
        ...config },
      { configure: false },
      {
        data: { flags: { [MODULE_ID]: {
          respondsTo: askMessage.id,
          ...(timedOut ? { timedOut: true } : {})
        } } },
        ...(setting(S.concVisibility) ? {} : { rollMode: PRIVATE_ROLL_MODE })
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
 * Which pending ask a message answers: the `respondsTo` stamp, or a bare sheet-rolled save
 * matching a pending ask's actor and ability (never one in an activity chain). Priority 0: a bare
 * roll is concentration's before anyone's; it answers the OLDEST pending ask.
 */
registerDemand("concentration", {
  priority: 0, chained: false,
  answering: flag => flag ? {} : null,
  pendingEntry: (flag, f) => ((f.rollType === "save") && (flag.status === "pending") && (flag.actorUuid === f.actorUuid)
    && (flag.ability === f.ability)) ? {} : null,
  pendingFor: (flag, uuid) => ((flag.status === "pending") && (flag.actorUuid === uuid)) ? {} : null
});
function concAskAnsweredBy(message) {
  const found = demandAnsweredBy(message);
  return (found?.flagKey === "concentration") ? found.matches[0]?.card.id ?? null : null;
}

/** Same-client fold latch — the create watcher and the render resume can race in one tick. */
const concFolds = new Set();

/**
 * Fold a roll into its ask and act on the verdict. ⚠ The ask's DC is the authority, not the
 * roll's target: a sheet-rolled save carries rollConcentration's default target of 10.
 */
async function foldConcentrationRoll(askMessage, rollMessage) {
  if ( !askMessage || concFolds.has(askMessage.id) ) return;
  concFolds.add(askMessage.id);
  try {
    const ask = foundry.utils.deepClone(askMessage.getFlag(MODULE_ID, "concentration") ?? {});
    if ( ask.status !== "pending" ) return;
    const roll = rollMessage.rolls?.[0];
    if ( !roll ) return;

    // WITHHELD: the ask owns the DC, so a rescue is offered only on a FAILURE and the verdict
    // waits for it. The clock's own roll is never withheld. The ask records the paused roll so
    // its buzzer folds that one rather than rolling a second save.
    if ( !rollMessage.getFlag(MODULE_ID, "timedOut")
      && await withholds(rollMessage, { by: "concentration", card: askMessage, uuid: ask.actorUuid, total: roll.total, dc: ask.dc }) ) {
      if ( ask.withheld !== rollMessage.id ) await askMessage.setFlag(MODULE_ID, "concentration", { ...ask, withheld: rollMessage.id });
      return;
    }
    // Through the save side of the fold: a reroll or a die the rescue added is the number judged.
    const judged = foldedSave({ total: roll.total, dc: ask.dc, folds: foldsFrom(key => rollMessage.getFlag(MODULE_ID, key), SAVE_FOLDS) });

    const actor = await fromUuid(ask.actorUuid);
    // ⚠ Freeze visibility AT VERDICT TIME: a setting flip during the pause below must not
    // re-address the announcement. Stored so a crash-resume announces to the same ears.
    const whisper = setting(S.concVisibility) ? null : concRecipients(actor);

    ask.status = "done";
    ask.outcome = {
      total: judged.total,
      success: judged.outcome === "saved",
      ...(rollMessage.getFlag(MODULE_ID, "timedOut") ? { timedOut: true } : {}),
      rollMessageId: rollMessage.id,
      // The crash-resume contract: the consequence sets `applied`; a stale done-but-unapplied
      // outcome is re-driven on render. An outcome without `answeredAt` is never re-driven.
      answeredAt: Date.now(),
      ...(whisper ? { whisperIds: whisper } : {})
    };
    disarmAskTimer(concTimers, askMessage.id);
    await askMessage.setFlag(MODULE_ID, "concentration", ask);

    await dramaticVerdictPause(rollMessage);

    if ( ask.outcome.success ) {
      if ( actor?.concentration?.effects?.size ) await announceConcentrationHolds(actor, ask, whisper);
    } else {
      await breakConcentration(actor, { names: ask.names, effectIds: ask.effectIds, ask });
    }
    await markConcApplied(askMessage);
  } finally {
    concFolds.delete(askMessage.id);
  }
}

// A verdict this machine paused for a rescue offer is finished by the same fold, handed back by the spine.
registerWithheld("concentration", {
  resume: ({ cardId }, rollMessage) => {
    const card = game.messages.get(cardId);
    return card ? foldConcentrationRoll(card, rollMessage) : undefined;
  }
});

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
 * Crash-resume: the fold marked the flag done, then its client died inside the verdict pause, so
 * the break never happened. Re-drives a stale done-but-unapplied outcome. Idempotent enough:
 * ending gone effects no-ops; a duplicate card after a real crash beats silence.
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
 * End concentration the system's way (endConcentration → the `dependentOn` cascade) and say so
 * in public: icons just vanished across the table (DESIGN.md R5). With breaking off, announce only.
 */
async function breakConcentration(actor, { names = [], effectIds = null, ask = null, reason = null } = {}) {
  const breaks = setting(S.concBreak);
  // Ending is a write to the concentrator: a PC's own client may do it; an NPC with no GM cannot.
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
        : reason === "incapacitated"
        ? `${actor?.name ?? "The concentrator"} is Incapacitated — Concentration is broken, no save`
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
 * Expiry ROLLS — the save always happens. The buzzer first folds an answer that already landed.
 */
const armConcTimer = message => armAskTimer(concTimers, message, "concentration", fireConcTimer);

async function fireConcTimer(askMessage) {
  // A roll already paused for a rescue offer (the withhold) is THE answer — its own clock finishes it.
  const withheld = askMessage.getFlag(MODULE_ID, "concentration")?.withheld;
  const paused = withheld ? game.messages.get(withheld) : null;
  if ( paused ) return foldConcentrationRoll(askMessage, paused);
  const landed = game.messages.find(m => m.getFlag(MODULE_ID, "respondsTo") === askMessage.id);
  if ( landed ) return foldConcentrationRoll(askMessage, landed);
  const ask = askMessage.getFlag(MODULE_ID, "concentration");
  const actor = await fromUuid(ask?.actorUuid ?? "");
  if ( !(actor instanceof Actor) ) {
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
    // The fold is driven by whoever drives the ask's subject, looked up from the ask.
    const askId = concAskAnsweredBy(message);
    const askMsg = askId ? game.messages.get(askId) : null;
    const subject = askMsg?.getFlag(MODULE_ID, "concentration")?.actorUuid ?? null;
    if ( askMsg && drivesMomentFor(subject) ) void foldConcentrationRoll(askMsg, message);
  }
  // A fresh ask: arm the clock; in auto mode the elected roller rolls, no popup.
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
      try { ui.chat?.updateMessage?.(next); } catch { /* row refreshes next render */ }
    }
  }
});

// The shown-latch rides ui.js's one delete-sweep; only this machine's clock disarms here.
Hooks.on("deleteChatMessage", message => {
  disarmAskTimer(concTimers, message.id);
});

/**
 * The ask's row: pending = the bar plus a Roll control (prompt mode); done = the outcome in one
 * line. Stateless, and the resume point: re-arms the clock, folds a landed answer, re-volunteers.
 */
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const ask = message.getFlag(MODULE_ID, "concentration");
  if ( !ask ) return;

  // The crash-resume: done-but-unapplied and stale past any live pause.
  if ( (ask.status === "done") && ask.outcome?.answeredAt && !ask.outcome.applied
    && drivesMomentFor(ask.actorUuid) && (Date.now() - ask.outcome.answeredAt > 20_000) ) void resumeConcOutcome(message);

  const row = document.createElement("div");
  row.className = "battleflow-concentration";

  if ( ask.status === "pending" ) {
    row.innerHTML = holdBarHTML(ask, "to roll");
    scheduleBarSync(row);
    armConcTimer(message);

    // Resume: an answer landed while nobody could fold it. Whole-log by flag.
    if ( drivesMomentFor(ask.actorUuid) ) {
      const landed = game.messages.find(m => m.getFlag(MODULE_ID, "respondsTo") === message.id);
      if ( landed ) void foldConcentrationRoll(message, landed);
    }
    if ( setting(S.concMode) === "auto" ) void autoRollConcentration(message);

    const actor = resolveUuid(ask.actorUuid);
    if ( (setting(S.concMode) === "prompt") && canAnswerFor(actor) ) {
      // Auto-show only the OLDEST pending ask (asks queue); the button recalls any.
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
      : o.autoFailed ? `fails automatically — ${o.autoFailedBy ?? "the condition"} — broken`
      : `${o.total} vs DC ${ask.dc} — ${o.success ? "holds" : "broken"}${o.timedOut ? " (timer)" : ""}`;
    Object.assign(line.style, {
      marginTop: "0.3rem", fontSize: "var(--font-size-11, 11px)",
      fontWeight: "bold", opacity: "0.8"
    });
    row.appendChild(line);
  }
  html.querySelector(SURFACES.messageContent)?.appendChild(row);
});

// Dialogs on their way up — between the call and the render that adopts them (saves.js's shape).
const concDialogsOpening = new Set();

/**
 * The popup IS the system's own saving throw dialog (`rollConcentration`, `configure: true`),
 * the ask riding `dialog.options` as a DialogCarried the spine paints and adopts under the popup
 * key (RULINGS *The gate before the roll*). Dismissing is not an answer: the buzzer still rolls.
 */
async function showConcPopup(message, ask) {
  if ( !ask || (ask.status !== "pending") ) return;
  const key = popupKey(message.id, "concentration");
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return; }
  if ( concDialogsOpening.has(key) || concRollsInFlight.has(message.id) ) return;
  concDialogsOpening.add(key);
  try {
    if ( game.messages.some(m => m.getFlag(MODULE_ID, "respondsTo") === message.id) ) return;
    const actor = await fromUuid(ask.actorUuid);
    if ( !(actor instanceof Actor) || !canAnswerFor(actor) ) return;
    const abilityLabel = CONFIG.DND5E.abilities[ask.ability]?.label ?? "Constitution";
    const demand = new DialogCarried({
      cardId: message.id, key, failed: null,
      owed: card => card.getFlag(MODULE_ID, "concentration")?.status === "pending",
      present: () => ({
        img: actor.img ?? null,
        eyebrow: "Concentration check",
        title: `${abilityLabel} save, DC ${ask.dc}`,
        subtitle: `${ask.actorName} — concentrating on ${ask.names?.join(", ") || "a spell"}`,
        lines: [
          causeLine(ask.cause, ask.damage),
          ...(ask.breaker ? [breakerLine(ask.breaker)] : []),
          `A failed save ends <strong>${ask.names?.join(", ") || "the spell"}</strong>`
            + `${setting(S.concBreak) ? "" : " (breaking is off — the GM ends it by hand)"}.`
        ],
        tone: "pending"
      }),
      bar: card => card.getFlag(MODULE_ID, "concentration")
    });
    // The breaker's Disadvantage is the roll's own; the gate's box says why (reminders.js).
    const rolls = await actor.rollConcentration(
      { target: ask.dc, ...breakerRolls(ask) },
      { configure: true, options: { bfSaveDemand: demand } },
      {
        data: { flags: { [MODULE_ID]: { respondsTo: message.id } } },
        ...(setting(S.concVisibility) ? {} : { rollMode: PRIVATE_ROLL_MODE })
      }
    );
    if ( !rolls?.length && demand.failed ) await foldConcentrationAutoFail(message, demand.failed);
  } catch(err) {
    console.error(`${TITLE} | Concentration dialog failed — roll it from the sheet.`, err);
  } finally {
    concDialogsOpening.delete(key);
  }
}

/**
 * The fold without a die: a save the rules fail before it is rolled (the dialog's Fails). Recorded
 * with `total` null and the condition named; the break follows as for a rolled failure.
 */
async function foldConcentrationAutoFail(askMessage, sources = []) {
  if ( !askMessage || concFolds.has(askMessage.id) ) return;
  concFolds.add(askMessage.id);
  try {
    const ask = foundry.utils.deepClone(askMessage.getFlag(MODULE_ID, "concentration") ?? {});
    if ( ask.status !== "pending" ) return;
    const actor = await fromUuid(ask.actorUuid);
    const whisper = setting(S.concVisibility) ? null : concRecipients(actor);
    ask.status = "done";
    ask.outcome = {
      total: null, success: false, autoFailed: true,
      autoFailedBy: sources.filter(s => s.autoFail).map(s => s.statusName).join(", ") || null,
      answeredAt: Date.now(),
      ...(whisper ? { whisperIds: whisper } : {})
    };
    disarmAskTimer(concTimers, askMessage.id);
    await askMessage.setFlag(MODULE_ID, "concentration", ask);
    await breakConcentration(actor, { names: ask.names, effectIds: ask.effectIds, ask });
    await markConcApplied(askMessage);
  } finally {
    concFolds.delete(askMessage.id);
  }
}

/**
 * THE PLATFORM'S CONCENTRATION PROMPTS ARE VETOED (NOTES §2 *the 6.0 pass*): both asking would be
 * two asks for one save, racing. Matched by TYPE (`isConcentrationPrompt`), never by content, and
 * only while an active GM exists — a GM-less table falls back to the native prompt, not silence.
 */
Hooks.on("preCreateChatMessage", doc => {
  if ( setting(S.concMode) === "off" ) return;
  if ( !game.users.activeGM ) return;
  if ( !isConcentrationPrompt(doc) ) return;
  return false;
});

