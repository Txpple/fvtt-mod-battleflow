/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): Riposte, the `riposte` fold (v1.19.0, FLOW
 * item 1) — an enemy's melee miss answered with a real driven attack, the superiority die riding
 * its damage. The argument for BOTH folds (the flag never touches `hold`, the interrupt list,
 * the resolver, the per-roll rider ruling) is precision.js's header, kept whole there.
 * The machine-tier pass, Stage 4a (2026-09-05): split out of maneuvers.js by MOMENT — one
 * feature per file, the shared readers in lookup.js, the rules text in decide/registry.js. Every
 * body here is the one maneuvers.js carried; nothing was rewritten.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, queueFlagWrite, canAnswerFor, statContext } from "./core.js";
import { resolveUuid, usableManeuver, maneuverDieFormula, meleeOptions, preferredMeleeOption } from "./lookup.js";
import { maneuverFoldEntries } from "./settings.js";
import { RULE_TEXT } from "./decide/registry.js";
import { hitTargets, modeAllows, reactionSpent, spendReaction } from "./shared.js";
import { popupKey, bfCard, holdBarHTML, ruleLine } from "./decide/present.js";
import { livePopups, openMomentPopup, momentButton, scheduleBarSync, shownMoments,
  armDeadline, disarmDeadline, registerRelay } from "./ui.js";

/* =============================================================================================
 * RIPOSTE
 * ========================================================================================== */

const riposteTimers = new Map();
const riposteInFlight = new Set();

/** One-shot armed dice for the injection below: reactor uuid → {formula, type, armedAt}. */
const riposteDie = new Map();
const RIPOSTE_DIE_TTL_MS = 60_000;

/** Stamp: the elect, on the ENEMY's attack message — the Graze miss-path template. */
Hooks.on("createChatMessage", async message => {
  try {
    if ( !isActiveGM() ) return;
    if ( message.getFlag("dnd5e", "roll.type") !== "attack" ) return;
    if ( message.getFlag(MODULE_ID, "riposte") ) return;               // never re-stamp
    if ( message.getFlag(MODULE_ID, "riposteFor") ) return;            // a driven attack never chains re-offers
    const entry = maneuverFoldEntries().find(e => e.kind === "riposte");
    if ( !entry ) return;
    const activityUuid = message.getFlag("dnd5e", "activity")?.uuid;
    const attackActivity = activityUuid ? await fromUuid(activityUuid) : null;
    if ( attackActivity?.attack?.type?.value !== "melee" ) return;     // melee misses only (P3)
    const attacker = message.getAssociatedActor?.();
    if ( !attacker ) return;

    const hitSet = new Set(hitTargets(message).map(t => t.uuid));      // as rolled — Graze's no-reopen
    const reactors = [];
    for ( const t of (message.getFlag("dnd5e", "targets") ?? []) ) {
      if ( hitSet.has(t.uuid) ) continue;
      const actor = await fromUuid(t.uuid).catch(() => null);
      if ( !(actor instanceof Actor) ) continue;
      if ( (actor.system.attributes?.hp?.value ?? 0) <= 0 ) continue;  // the dead don't riposte
      if ( actor.uuid === attacker.uuid ) continue;
      // ⚠ NOT a budget test — this flag is the CLICK-VOLUME GUARD (hold.js), and the module
      // does not track action economy at all: that is the table's job, by user ruling. Every
      // read of it, here and in hold.js/saves.js, only declines to OFFER; nothing anywhere
      // refuses a cast or blocks an action. Read as "don't nag this actor again this turn."
      // The old wording here said "one reaction per round" and led a careful reviewer to
      // diagnose a rules violation the module cannot commit.
      if ( reactionSpent(actor) ) continue;
      if ( !modeAllows(actor) ) continue;                              // rides the resolver (Graze's argument)
      const found = usableManeuver(actor, entry.name);
      const dieFormula = found ? maneuverDieFormula(found.activity) : null;
      if ( !found || !dieFormula ) continue;
      if ( !meleeOptions(actor).length ) continue;                     // nothing to swing back with
      reactors.push({
        uuid: t.uuid, name: t.name,
        itemId: found.item.id, activityId: found.activity.id,
        itemName: found.item.name, itemImg: found.item.img,
        dieFormula, answer: null
      });
    }
    if ( !reactors.length ) return;

    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    await message.setFlag(MODULE_ID, "riposte", {
      status: "pending",
      attackerUuid: attacker.uuid, attackerName: attacker.name,
      ...statContext(attacker.uuid), // the data-plane stamp — the swing that invited the counter
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}),
      reactors
    });
    armRiposteTimer(message);
  } catch(err) {
    console.error(`${TITLE} | Riposte stamp failed.`, err);
  }
});

/* Per-reactor answers don't fit armAskTimer's single-answer shape — the per-target gate on
 * the spine's raw clock (the topple timer's idiom). */
function armRiposteTimer(message) {
  const flag = message?.getFlag(MODULE_ID, "riposte");
  if ( !flag?.deadline || (flag.status !== "pending") || !isActiveGM() ) return;
  if ( !(flag.reactors ?? []).some(r => !r.answer) ) return;
  armDeadline(riposteTimers, message.id, flag.deadline, fireRiposteTimer);
}

const disarmRiposteTimer = messageId => disarmDeadline(riposteTimers, messageId);

/** Expiry DECLINES — a reaction nobody took is a reaction not taken (the hold's pass, not
 * the save machine's roll: nothing here is mandatory). */
async function fireRiposteTimer(messageId) {
  try {
    const message = game.messages.get(messageId);
    if ( !message ) return;
    await queueFlagWrite(message, "riposte", current => {
      if ( current.status !== "pending" ) return;
      for ( const r of current.reactors ?? [] ) {
        if ( !r.answer ) { r.answer = "declined"; r.timedOut = true; }
      }
      if ( (current.reactors ?? []).every(r => r.answer) ) current.status = "resolved";
    });
  } catch(err) {
    console.error(`${TITLE} | Riposte buzzer failed.`, err);
  }
}

/** One reactor's answer — claim through the flag lock; "riposte" executes on this client.
 * ⚠ A PLAYER reactor cannot update the enemy's attack message (ChatMessage update is
 * author-or-GM), so their answer travels as their OWN message and the elect folds it in —
 * hold.js answerHold's §4.1 split, applied here. The driven attack still runs on the
 * answering client (their dice, their pool); the fold and the drive are independent, and
 * the elect's 20s crash-resume covers a client that died between the two. */
async function answerRiposte(message, uuid, answer, { weaponId = null, weaponName = null } = {}) {
  if ( !message.isOwner ) {
    const live = message.getFlag(MODULE_ID, "riposte");
    const reactor = live?.reactors?.find(x => x.uuid === uuid);
    if ( !reactor || reactor.answer || (live.status !== "pending") ) return;
    const actor = resolveUuid(uuid);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: bfCard({
        img: reactor.itemImg, eyebrow: `Maneuver — ${reactor.itemName}`,
        tone: (answer === "riposte") ? "good" : "neutral",
        title: (answer === "riposte")
          ? `${reactor.itemName} — ${reactor.name} strikes back${weaponName ? ` with ${weaponName}` : ""}`
          : `${reactor.itemName} — ${reactor.name} declines`,
        subtitle: `${live.attackerName}'s melee attack missed`
      }),
      flags: { [MODULE_ID]: { riposteAnswer: {
        messageId: message.id, uuid, answer, weaponId, weaponName
      } } }
    });
    if ( answer === "riposte" ) await resolveRiposte(message, uuid, weaponId, { trusted: true });
    return;
  }
  let claimed = false;
  await queueFlagWrite(message, "riposte", current => {
    const r = (current.reactors ?? []).find(x => x.uuid === uuid);
    if ( !r || r.answer || (current.status !== "pending") ) return;
    r.answer = answer;
    r.answeredAt = Date.now();   // the crash-resume horizon (the topple discipline)
    if ( weaponId ) { r.weaponId = weaponId; r.weaponName = weaponName; }
    if ( (current.reactors ?? []).every(x => x.answer) ) current.status = "resolved";
    claimed = true;
  });
  if ( !claimed || (answer !== "riposte") ) return;
  await resolveRiposte(message, uuid, weaponId);
}

/** A relayed answer landing: the ELECT folds it into the riposte flag (idempotent - the claim
 * rules are the same as the direct path's, so a twin relay changes nothing).
 * ⚠ Through the spine's relay registry since the §4.1 consolidation. `owns` ignores the flag
 * here because the elect is the owner; the hold's relay is the one that reads it. */
registerRelay("riposteAnswer", {
  flagKey: "riposte",
  targetOf: a => a.messageId,
  owns: () => isActiveGM(),
  fold: (current, a) => {
    const r = (current.reactors ?? []).find(x => x.uuid === a.uuid);
    if ( !r || r.answer || (current.status !== "pending") ) return;
    r.answer = a.answer;
    r.answeredAt = Date.now();
    if ( a.weaponId ) { r.weaponId = a.weaponId; r.weaponName = a.weaponName; }
    if ( (current.reactors ?? []).every(x => x.answer) ) current.status = "resolved";
  }
});

/** Has this reactor's driven attack already been made? The provenance flags ARE the receipt. */
const riposteDriven = (messageId, uuid) => game.messages.contents.some(m =>
  (m.getFlag(MODULE_ID, "riposteFor") === messageId) && (m.getFlag(MODULE_ID, "riposteBy") === uuid));

/** The accept path: use the maneuver, spend the reaction, arm the die, drive the attack.
 * `trusted` is the relay branch trusting its OWN just-posted answer — the flag fold happens
 * on the elect a beat later, and waiting for the round-trip would idle the player's dice. */
async function resolveRiposte(message, uuid, weaponId, { trusted = false } = {}) {
  const key = `${message.id}|${uuid}`;
  if ( riposteInFlight.has(key) ) return;
  riposteInFlight.add(key);
  try {
    const flag = message.getFlag(MODULE_ID, "riposte");
    const reactor = flag?.reactors?.find(r => r.uuid === uuid);
    if ( !reactor ) return;
    if ( !trusted && (reactor.answer !== "riposte") ) return;
    if ( riposteDriven(message.id, uuid) ) return;   // idempotent — the attack already exists
    const actor = await fromUuid(uuid);
    if ( !(actor instanceof Actor) ) return;
    const attackerToken = canvas.tokens?.placeables?.find(t => t.actor?.uuid === flag.attackerUuid);

    // Aim first, so every card in the sequence says who it is aimed at.
    const priorTargets = [...game.user.targets].map(t => t.id);
    if ( attackerToken ) {
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      attackerToken.setTarget(true, { releaseOthers: true });
    }

    try {
      // 1. REALLY use the maneuver — the pool is consumed by the system (P2), and the
      //    reaction is SPENT: the hold's own setter fires only when reactionHold is on, so
      //    the fold sets the same flag itself, same in-combat carve-out, idempotently.
      const item = actor.items.get(reactor.itemId);
      const activity = item?.system.activities?.contents?.find(a => a.id === reactor.activityId);
      if ( !activity ) return;
      //    ⚠ subsequentActions:false or dnd5e follows the use by rolling the maneuver's own
      //    damage activity — a native d8 config dialog parked over the whole resolution
      //    (walk-4 finding (v)). Consumption and the card are all this step wants.
      await activity.use({ subsequentActions: false }, { configure: false }, {
        data: { flags: { [MODULE_ID]: { riposteUse: message.id } } }
      });
      void spendReaction(actor, { origin: activity.item?.uuid ?? null, what: activity.item?.name ?? "the riposte" });

      // 2. Arm the one-shot die for the injection hook, THEN drive the real attack — the
      //    P3-measured shape: use() for the usage card, rollAttack chained to it, module
      //    provenance in FLAT message data (nested data is invisible to the riders).
      const options = meleeOptions(actor);
      const wantId = weaponId ?? reactor.weaponId ?? null;   // the stored choice survives a crash-resume
      const chosen = options.find(o => o.itemId === wantId) ?? preferredMeleeOption(actor, options);
      if ( !chosen ) return;
      const weapon = actor.items.get(chosen.itemId);
      const weaponAct = weapon?.system.activities?.contents?.find(a => a.id === chosen.activityId);
      if ( !weaponAct ) return;
      riposteDie.set(uuid, {
        formula: reactor.dieFormula,
        type: [...(weapon.system.damage?.base?.types ?? [])][0] ?? "",
        armedAt: Date.now()
      });
      const use = await weaponAct.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = use?.message?.id ?? null;
      await weaponAct.rollAttack({}, { configure: false }, {
        data: {
          "flags.dnd5e.originatingMessage": usageId ?? message.id,
          [`flags.${MODULE_ID}.riposteFor`]: message.id,
          [`flags.${MODULE_ID}.riposteBy`]: uuid
        }
      });
      // The rest is the ordinary pipeline: rollAttackV2 fires here (P3), auto-damage rolls
      // or offers, the injection below adds the die, auto-apply and the riders do their
      // usual work on the elect. Nothing else to drive.
    } finally {
      // Put the table back the way the reactor had it.
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      for ( const id of priorTargets ) canvas.tokens?.get(id)?.setTarget(true, { releaseOthers: false });
    }
  } catch(err) {
    console.error(`${TITLE} | Riposte resolution failed.`, err);
  } finally {
    riposteInFlight.delete(key);
  }
}

/** The die injection — the hit-riders push idiom, gated on the armed one-shot. */
Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
  try {
    const activity = config.subject;
    if ( activity?.type !== "attack" ) return;
    const actor = activity.item?.actor;
    if ( !actor ) return;
    const armed = riposteDie.get(actor.uuid);
    if ( !armed ) return;
    if ( (Date.now() - armed.armedAt) > RIPOSTE_DIE_TTL_MS ) { riposteDie.delete(actor.uuid); return; }
    // When the damage names its chain, verify it leads to OUR driven attack — a different
    // attack rolled inside the window must not inherit the die. A chainless roll (the native
    // button) falls back to the actor+TTL match.
    const originId = message?.data?.["flags.dnd5e.originatingMessage"];
    if ( originId ) {
      const origin = game.messages.get(originId);
      if ( origin ) {
        const chainAttacks = (origin.getFlag("dnd5e", "roll.type") === "attack")
          ? [origin] : (origin.getAssociatedRolls?.("attack") ?? []);
        if ( !chainAttacks.some(a => a.getFlag(MODULE_ID, "riposteFor")) ) return;
      }
    }
    riposteDie.delete(actor.uuid);   // one-shot, consumed
    // The die folds INTO the base roll (v1.19.x finding (d) — the walk: it must ride the
    // snap-back's own roll, one dice group, one total; a pushed entry rendered as its own
    // window). A base part crit-doubles too — a riposte crit doubling the superiority die
    // is the 2024 rule. The typed-entry push stays only as the never-observed fallback.
    const base = (config.rolls ?? []).find(r => r.base === true);
    if ( base ) base.parts = [...(base.parts ?? []), armed.formula];
    else config.rolls.push({
      data: config.rolls[0]?.data ?? {},
      parts: [armed.formula],
      options: { type: armed.type, types: armed.type ? [armed.type] : [] }
    });
  } catch(err) {
    console.error(`${TITLE} | Riposte die injection failed.`, err);
  }
});

/* The riposte's swing never ends in silence (finding (p)): a MISS announces itself, so any
 * Graze/Precision offer that follows ((e)-KEEP — driven attacks are real attacks) arrives
 * from an announced miss instead of from nowhere. The ROLLING client posts (rollAttackV2's
 * locality — one client, one card); the HIT half of (p) lives in offerDamageRoll, which
 * names the riposte as its own moment and notes the riding die. */
Hooks.on("dnd5e.rollAttackV2", async rolls => {
  try {
    const message = rolls?.[0]?.parent;
    if ( !(message instanceof ChatMessage) ) return;
    const riposteFor = message.getFlag(MODULE_ID, "riposteFor");
    if ( !riposteFor ) return;
    if ( hitTargets(message).length ) return;   // the hit's moment is the damage offer
    const reactor = message.getAssociatedActor?.();
    const held = game.messages.get(riposteFor)?.getFlag(MODULE_ID, "riposte");
    const r = held?.reactors?.find(x => x.uuid === message.getFlag(MODULE_ID, "riposteBy"));
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: reactor }),
      content: bfCard({
        img: r?.itemImg ?? null, eyebrow: `Maneuver — ${r?.itemName ?? "Riposte"}`,
        tone: "neutral",
        title: `${r?.itemName ?? "Riposte"} — the strike back misses`,
        subtitle: `${reactor?.name ?? "The reactor"}'s answer to ${held?.attackerName ?? "the attacker"}`
          + `${r?.weaponName ? ` — ${r.weaponName}` : ""}`
      })
    });
  } catch(err) {
    console.error(`${TITLE} | Riposte miss announce failed.`, err);
  }
});

/** The Riposte/Pass popup — two controls plus the weapon choice (an input, like the topple
 * bonus field: inputs inform the answer, they are not answers). */
async function showRipostePopup(message, flag, reactor) {
  const actor = resolveUuid(reactor.uuid);
  // The weapon choice (finding ④, the walk's ruling): default to the weapon last attacked
  // with; a single equipped melee weapon skips the dropdown entirely and is simply NAMED.
  const options = actor ? meleeOptions(actor) : [];
  const preferred = actor ? preferredMeleeOption(actor, options) : null;
  const selectHTML = (options.length > 1) ? `
    <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;">
      <label style="flex:1;font-size:var(--font-size-12,12px);">Riposte with</label>
      <select name="bf-riposte-weapon" style="flex:1;min-width:0;">${options
        .map(o => `<option value="${o.itemId}"${o.itemId === preferred?.itemId ? " selected" : ""}>${o.label}</option>`)
        .join("")}</select>
    </div>` : "";
  let dialog;
  const answer = kind => {
    const chosenId = dialog?.element?.querySelector('select[name="bf-riposte-weapon"]')?.value
      ?? preferred?.itemId ?? null;
    return answerRiposte(message, reactor.uuid, kind, {
      weaponId: chosenId,
      // The clean name, never the display label — "(stowed)" is popup dressing, not card record.
      weaponName: options.find(o => o.itemId === chosenId)?.name ?? preferred?.name ?? null
    });
  };
  dialog = await openMomentPopup(message, `riposte:${reactor.uuid}`, actor, {
    title: `Riposte — ${reactor.name}`, icon: "fa-solid fa-reply",
    content: bfCard({
      img: reactor.itemImg, eyebrow: `Maneuver — ${reactor.itemName}`, tone: "pending",
      title: `${flag.attackerName} missed you`,
      // (z): the rule line is the maneuver's own sentence, verbatim; the one-weapon note
      // stays as the module's hint.
      lines: [ruleLine(RULE_TEXT.riposte),
        ...((options.length === 1) ? [`Riposte with <strong>${preferred?.label ?? "your weapon"}</strong> — your one melee weapon.`] : [])]
    }) + selectHTML + holdBarHTML(flag, "to answer"),
    buttons: [
      { action: "riposte", label: preferred && (options.length === 1) ? `Riposte with ${preferred.label}` : "Riposte",
        default: true, callback: () => answer("riposte") },
      { action: "pass", label: "Pass", callback: () => answer("declined") }
    ]
  });
}


/* =============================================================================================
 * THE ROWS, THE WATCHER, THE CLEANUP — maneuvers.js's shared plumbing, this fold's slice of it.
 * ========================================================================================== */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  // --- Riposte: one row per reactor on the enemy's attack card ------------------------------
  const r = message.getFlag(MODULE_ID, "riposte");
  if ( r?.reactors?.length ) {
    const row = document.createElement("div");
    row.className = "battleflow-maneuver";
    const pending = r.status === "pending";
    for ( const reactor of r.reactors ) {
      const line = document.createElement("div");
      line.innerHTML = bfCard({
        img: reactor.itemImg, eyebrow: `Maneuver — ${reactor.itemName}`,
        tone: !reactor.answer ? "pending" : (reactor.answer === "riposte" ? "good" : "neutral"),
        // Source, then result (⑦); the resolved line NAMES the weapon (④ — the walk's
        // "unclear how a weapon is picked" is answered on the card, not just in the popup).
        title: !reactor.answer ? `${reactor.itemName} — ${reactor.name} may strike back`
          : (reactor.answer === "riposte"
            ? `${reactor.itemName} — ${reactor.name} strikes back${reactor.weaponName ? ` with ${reactor.weaponName}` : ""}`
            : `${reactor.itemName} — ${reactor.name} declined${reactor.timedOut ? " (timer)" : ""}`),
        subtitle: `${r.attackerName}'s melee attack missed`
      });
      row.appendChild(line);
      if ( pending && !reactor.answer ) {
        const bar = document.createElement("div");
        bar.innerHTML = holdBarHTML(r, "to answer");
        row.appendChild(bar);
        const actor = resolveUuid(reactor.uuid);
        if ( canAnswerFor(actor) ) {
          const shownKey = popupKey(message.id, `riposte:${reactor.uuid}`);
          if ( !shownMoments.has(shownKey) ) {
            shownMoments.add(shownKey);
            void showRipostePopup(message, r, reactor);
          }
          row.appendChild(momentButton(`Answer — ${reactor.name}`, () => {
            const live = message.getFlag(MODULE_ID, "riposte");
            const lr = live?.reactors?.find(x => x.uuid === reactor.uuid);
            if ( live && lr && !lr.answer ) void showRipostePopup(message, live, lr);
          }));
        }
      }
    }
    if ( pending ) { scheduleBarSync(row); armRiposteTimer(message); }
    // Crash-resume, elect-owned, 20s horizon (the precision block's twin): an accepted
    // riposte whose driving client died is answer="riposte" with no driven attack in the
    // log — the provenance flags are the receipt, so the check is exact.
    if ( isActiveGM() ) {
      for ( const reactor of r.reactors ?? [] ) {
        if ( (reactor.answer === "riposte") && reactor.answeredAt
          && (Date.now() - reactor.answeredAt > 20_000)
          && !riposteDriven(message.id, reactor.uuid) ) {
          void resolveRiposte(message, reactor.uuid, null);
        }
      }
    }
    html.querySelector(".message-content")?.appendChild(row);
  }
});

// Every client closes answered popups; the timers disarm when nothing is pending.
Hooks.on("updateChatMessage", message => {
  const r = message.getFlag(MODULE_ID, "riposte");
  if ( r ) {
    for ( const reactor of r.reactors ?? [] ) {
      if ( !reactor.answer ) continue;
      const dialog = livePopups.get(popupKey(message.id, `riposte:${reactor.uuid}`));
      if ( dialog ) void dialog.close();
    }
    if ( !(r.reactors ?? []).some(x => !x.answer) ) disarmRiposteTimer(message.id);
    else armRiposteTimer(message);
  }
});

// The shown-latches ride ui.js's one delete-sweep; only this machine's clock disarms here.
Hooks.on("deleteChatMessage", message => {
  disarmRiposteTimer(message.id);
});
