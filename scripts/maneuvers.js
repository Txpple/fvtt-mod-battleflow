/**
 * Battle Flow — Phase 1.6 (v1.19.0): the maneuver folds. Precision Attack patches a declared
 * miss after the fact; Riposte answers an enemy's melee miss with a real attack. FLOW item 1.
 * Split shape (design.md §9); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, queueFlagWrite } from "./core.js";
import { hitTargets, modeAllows } from "./shared.js";
import { canAnswerFor, inRunningCombat } from "./hold.js";
import { livePopups, popupKey, openManagedPopup, bfCard, holdBarHTML, scheduleBarSync } from "./ui.js";
import { armAskTimer, disarmAskTimer } from "./mastery.js";
// Safe statically (the saves.js:12 argument): the entry evaluates auto-damage.js at :90 and
// this file at :97, so nothing here can reorder auto-damage's registrations. Re-checked with
// check-hook-order; do not move this file's entry position without re-running it.
import { offerDamageRoll, rollDamageForAttack } from "./auto-damage.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 1.6 — the maneuver folds (FLOW item 1, built v1.19.0 after probes P1-P3).
 *
 * Two folds, one list (`maneuverFolds`, and the LIST is the switch):
 *
 *   PRECISION ("your own attack missed"): the attacker's client stamps a `precision` flag on
 *   the missed attack message; the attacker is offered the maneuver (Use/Pass, the hold's
 *   clock); accepting really USES the maneuver activity (the superiority die is consumed by
 *   the system, never mimed — the castReaction honesty rule), rolls the die publicly, writes
 *   per-target verdicts through hitTargets' own override channel (the hold's channel with the
 *   arrow reversed — shared.js), announces the arithmetic, and re-drives the damage exactly
 *   as the hold's continuation does: the popup if the player owns their dice, the straight
 *   roll otherwise.
 *
 *   RIPOSTE ("an enemy's melee attack missed you"): the elect stamps a `riposte` flag on the
 *   ENEMY's attack message (the Graze miss-path template — createChatMessage, complement of
 *   hitTargets, read AS ROLLED so a later hold flip never re-opens it); each eligible reactor
 *   is offered it on their own client; accepting really uses the maneuver (consumes the pool;
 *   spends the reaction), then drives a REAL attack with the chosen melee weapon at the
 *   original attacker — through the ordinary pipeline, so the resolver, the riders, receipts
 *   and revert all treat it as any hand-rolled attack — with the superiority die pushed into
 *   its damage roll as an extra part (the hit-riders idiom, never a mutation).
 *
 * ⚠ THE FLAG NEVER TOUCHES `hold` — three measured hazards (2026-08-20 exploration): the
 * one-message-one-hold slot (hold.js:301), hitTargets treating ANY hold verdict as
 * authoritative truthiness, and hold.js being the tree's most fragile file. Own keys, own
 * popup namespaces, own timers. hold.js is imported for two exports and edited not at all.
 *
 * ⚠ RIPOSTE MUST NEVER RE-ENTER THE INTERRUPT LIST: the name alone re-arms three unrelated
 * behaviours there (the cast-is-the-answer matcher, reactionSpent's setter, the cast slice's
 * disqualifier) and the hold parser coerces unknown kinds to "ac" — the exact mis-wiring
 * v1.16.0 struck. This file's parser is STRICT for the same reason: unknown kinds drop with
 * a warning, never default.
 *
 * BOTH folds ride the RESOLVER (modeAllows — Graze's argument): their payoff is driven
 * damage, and with the resolver off there is no path for it that the table asked for.
 *
 * THE PER-ROLL RIDER RULING (recorded for Pass C, the volleys): a module-driven attack that
 * stamps the FLAT `flags.dnd5e.originatingMessage` key is a REAL attack — riders ride it
 * unchanged, because riderTargets' first branch resolves the chain. Riders ride attack ROLLS;
 * the all-targets-or-nothing intersection lives WITHIN one damage roll; N driven rolls are N
 * independent rider folds. Riposte is the shipped precedent.
 *
 * PRECISION'S SCOPE FENCE, deliberate: the offer fires only when the attack hit NOBODY. On a
 * mixed hit+miss multi-target swing the hits' damage already rolled (one roll serves every
 * target — standing item 1), and patching a miss in behind it would either double-apply to
 * the original hits or need per-target damage, the exact "much bigger change" that item
 * warns about. A clean miss is the whole table case (00:46, 01:14, 02:42, 03:01 — all
 * single-target).
 * ------------------------------------------------------------------------------------------- */

/* --- the list: strict parse, the list is the switch ---------------------------------------- */

const MANEUVER_KINDS = new Set(["precision", "riposte"]);
const warnedKinds = new Set();

export function maneuverEntries() {
  return String(setting(S.maneuverFolds) ?? "")
    .split(",").map(s => s.trim()).filter(Boolean)
    .map(chunk => {
      const [name, kind] = chunk.split(":").map(s => s?.trim());
      if ( !name || !MANEUVER_KINDS.has(kind?.toLowerCase()) ) {
        if ( !warnedKinds.has(chunk) ) {
          warnedKinds.add(chunk);
          console.warn(`${TITLE} | Maneuver Folds: "${chunk}" has no recognised kind (precision/riposte) — ignored, never guessed.`);
        }
        return null;
      }
      return { name, kind: kind.toLowerCase() };
    })
    .filter(Boolean);
}

/**
 * The actor's usable copy of a listed maneuver: the item by name (case-insensitive), its
 * first activity, and the consumption check — every itemUses consumption target must have a
 * use left (Precision/Riposte both draw on the Combat Superiority pool, measured by probe
 * P2). An activity with no consumption is simply usable.
 */
function usableManeuver(actor, name) {
  const item = actor?.items?.find(i => i.name.toLowerCase() === name.toLowerCase());
  const activity = item?.system.activities?.contents?.[0];
  if ( !activity ) return null;
  for ( const c of (activity.consumption?.targets ?? []) ) {
    if ( c.type !== "itemUses" ) continue;
    const pool = c.target ? actor.items.get(c.target) : item;
    if ( ((pool?.system.uses?.value ?? 0) <= 0) ) return null;
  }
  return { item, activity };
}

/** The die formula behind a maneuver — read from the item's own data, never typed anywhere:
 * a utility activity's roll formula (Precision) or a damage activity's first part (Riposte). */
function maneuverDieFormula(activity) {
  return activity.roll?.formula
    || activity.damage?.parts?.[0]?.formula
    || null;
}

const gmQuietFor = actor => game.user.isGM && !!actor?.hasPlayerOwner;

/* =============================================================================================
 * PRECISION ATTACK
 * ========================================================================================== */

const precisionTimers = new Map();
const shownPrecision = new Set();
const precisionInFlight = new Set();

/** Stamp: the roller's own client, on the attack message it authored. */
Hooks.on("dnd5e.rollAttackV2", async (rolls, { subject }) => {
  try {
    if ( !subject || (subject.type !== "attack") ) return;
    const attacker = subject.actor;
    if ( !attacker || !modeAllows(attacker) ) return;
    const attackMessage = rolls?.[0]?.parent;
    if ( !(attackMessage instanceof ChatMessage) ) return;
    if ( attackMessage.getFlag(MODULE_ID, "precision") ) return;      // never re-stamp
    const roll = rolls[0];
    if ( roll.isFumble ) return;                                       // a natural 1 stands
    const entry = maneuverEntries().find(e => e.kind === "precision");
    if ( !entry ) return;
    const found = usableManeuver(attacker, entry.name);
    const dieFormula = found ? maneuverDieFormula(found.activity) : null;
    if ( !found || !dieFormula ) return;

    // Clean misses only (the scope fence above): resolvable ACs, every one of them missed.
    const snapshot = attackMessage.getFlag("dnd5e", "targets") ?? [];
    if ( !snapshot.length || hitTargets(attackMessage).length ) return;
    const judged = snapshot.filter(t => (t.ac !== null) && (t.ac !== undefined));
    if ( !judged.length ) return;                                      // null AC — humans have it

    // The hopeless gate, the hold's own semantics: when even a maximised die cannot reach
    // the nearest AC, don't stop the game to offer it. Rides holdSkipFutile + holdReveal
    // exactly as the hold does — with the math hidden, a gate that reveals it stays off.
    const margins = judged.map(t => ({ uuid: t.uuid, name: t.name, ac: t.ac, margin: t.ac - roll.total }));
    if ( setting(S.holdSkipFutile) && setting(S.holdReveal) ) {
      const dieMax = (await new Roll(dieFormula, attacker.getRollData()).evaluate({ maximize: true })).total;
      if ( Math.min(...margins.map(m => m.margin)) > dieMax ) return;
    }

    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    await attackMessage.setFlag(MODULE_ID, "precision", {
      status: "pending",
      itemId: found.item.id, activityId: found.activity.id,
      itemName: found.item.name, itemImg: found.item.img,
      attackerUuid: attacker.uuid, attackTotal: roll.total, dieFormula,
      answer: null,
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}),
      targets: margins.map(m => ({ ...m, verdict: null }))
    });
    armPrecisionTimer(attackMessage);
  } catch(err) {
    console.error(`${TITLE} | Precision stamp failed.`, err);
  }
});

const armPrecisionTimer = message =>
  armAskTimer(precisionTimers, message, "precision", live => answerPrecision(live, "pass", { timedOut: true }));

/** One answer, first writer wins — serialized through the flag lock, then executed. */
async function answerPrecision(message, answer, { timedOut = false } = {}) {
  let claimed = false;
  await queueFlagWrite(message, "precision", current => {
    if ( (current.status !== "pending") || current.answer ) return;
    current.answer = answer;
    current.answeredAt = Date.now();   // the crash-resume horizon (the topple discipline)
    if ( timedOut ) current.timedOut = true;
    if ( answer !== "use" ) {
      current.status = "resolved";
      current.outcome = timedOut ? "passed (timer)" : "passed";
    }
    claimed = true;
  });
  if ( !claimed || (answer !== "use") ) return;
  await resolvePrecision(message);
}

/** The accept path: use the maneuver, roll the die, verdict, announce, re-drive. */
async function resolvePrecision(message) {
  if ( precisionInFlight.has(message.id) ) return;
  precisionInFlight.add(message.id);   // before the first await — the continueHold discipline
  try {
    const flag = message.getFlag(MODULE_ID, "precision");
    if ( !flag || (flag.answer !== "use") || (flag.status !== "pending") ) return;
    const attacker = await fromUuid(flag.attackerUuid);
    const item = attacker?.items?.get(flag.itemId);
    const activity = item?.system.activities?.get?.(flag.activityId)
      ?? item?.system.activities?.contents?.find(a => a.id === flag.activityId);
    if ( !(attacker instanceof Actor) || !activity ) return;

    // 1. REALLY use it — the system consumes the pool (P2: use() consumes, posts a card,
    //    rolls nothing). Recording "used" without using shipped a lie once (ui.js:407);
    //    never again.
    await activity.use({}, { configure: false }, {
      data: { flags: { dnd5e: { originatingMessage: message.id } } }
    });

    // 2. The die, public, from the item's own formula — provenance-stamped so no other
    //    recognizer (topple's bare-roll fold, the save machine) can claim it.
    const dieRoll = new Roll(flag.dieFormula, attacker.getRollData());
    await dieRoll.evaluate();
    await dieRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      flavor: `${flag.itemName} — the superiority die`,
      flags: { [MODULE_ID]: { respondsTo: message.id } }
    });
    const die = dieRoll.total;

    // 3. Verdicts, through the shared channel; graze conflict named, never unwound.
    const lines = [];
    let anyHit = false;
    await queueFlagWrite(message, "precision", current => {
      current.status = "resolved";
      current.outcome = "used";
      current.die = die;
      for ( const t of current.targets ?? [] ) {
        const total = (current.attackTotal ?? 0) + die;
        t.verdict = (total >= t.ac) ? "hit" : "miss";
        if ( t.verdict === "hit" ) anyHit = true;
        lines.push(`${current.attackTotal} + ${die} = ${total} vs AC ${t.ac} — `
          + (t.verdict === "hit" ? `<strong>now hits ${t.name}</strong>` : `still misses ${t.name}`));
      }
    });
    // Graze already paid on this miss? Say so — the ruling is announce, no unwind (the
    // symmetric twin of Graze's own "reads the attack as rolled" no-reopen).
    if ( (message.getFlag("dnd5e", "roll.mastery") === "graze")
      && message.getFlag(MODULE_ID, "receipt")?.targets?.length ) {
      lines.push("⚠ Graze already paid on the miss — revert its receipt if you rule it void.");
    }
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: bfCard({
        img: flag.itemImg, eyebrow: `Maneuver — ${flag.itemName}`,
        tone: anyHit ? "good" : "neutral",
        title: anyHit ? "The miss becomes a hit" : "Still a miss",
        subtitle: `${attacker.name} spends a superiority die`,
        lines
      })
    });

    // 4. The re-drive — the hold continuation's template: hitTargets re-run (it now reads
    //    the verdicts), the player's own dice honoured, the straight roll otherwise.
    if ( !anyHit || !hitTargets(message).length ) return;
    const attackActivity = await fromUuid(message.getFlag("dnd5e", "activity")?.uuid);
    if ( !attackActivity ) return;
    if ( setting(S.playerRollDamage) ) return void offerDamageRoll(attackActivity, message);
    await rollDamageForAttack(attackActivity, message);
  } catch(err) {
    console.error(`${TITLE} | Precision resolution failed.`, err);
  } finally {
    precisionInFlight.delete(message.id);
  }
}

/** The Use/Pass popup — the hold family's two controls, the margin shown under holdReveal. */
async function showPrecisionPopup(message, flag) {
  const attacker = (() => { try { return fromUuidSync(flag.attackerUuid); } catch { return null; } })();
  if ( !canAnswerFor(attacker) ) return;
  const key = popupKey(message.id, "precision");
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return; }
  const lines = [];
  if ( setting(S.holdReveal) ) {
    for ( const t of flag.targets ?? [] ) lines.push(`Needs +${t.margin} to reach ${t.name} (AC ${t.ac} vs ${flag.attackTotal}).`);
  }
  lines.push("The superiority die is spent either way it lands.");
  const dialog = new foundry.applications.api.DialogV2({
    window: { title: `Precision Attack — ${attacker?.name ?? ""}`, icon: "fa-solid fa-crosshairs" },
    position: { width: 440 },
    content: bfCard({
      img: flag.itemImg, eyebrow: `Maneuver — ${flag.itemName}`, tone: "pending",
      title: "The attack missed — patch it?",
      subtitle: `${flag.itemName}: roll the die and add it to the attack total.`,
      lines
    }) + holdBarHTML(flag, "to answer"),
    buttons: [
      { action: "use", label: `Use ${flag.itemName}`, default: true,
        callback: () => answerPrecision(message, "use") },
      { action: "pass", label: "Pass",
        callback: () => answerPrecision(message, "pass") }
    ],
    rejectClose: false
  });
  await openManagedPopup(key, message, dialog);
}

/* =============================================================================================
 * RIPOSTE
 * ========================================================================================== */

const riposteTimers = new Map();
const shownRiposte = new Set();
const riposteInFlight = new Set();

/** One-shot armed dice for the injection below: reactor uuid → {formula, type, armedAt}. */
const riposteDie = new Map();
const RIPOSTE_DIE_TTL_MS = 60_000;

/** The reactor's melee options — equipped weapons with a melee attack activity (P3: the
 * discriminator is activity.attack.type.value). */
function meleeOptions(actor) {
  const out = [];
  for ( const item of actor.items.filter(i => (i.type === "weapon") && i.system.equipped) ) {
    for ( const a of (item.system.activities?.contents ?? []) ) {
      if ( (a.type === "attack") && (a.attack?.type?.value === "melee") )
        out.push({ itemId: item.id, activityId: a.id, label: item.name });
    }
  }
  return out;
}

/** Stamp: the elect, on the ENEMY's attack message — the Graze miss-path template. */
Hooks.on("createChatMessage", async message => {
  try {
    if ( !isActiveGM() ) return;
    if ( message.getFlag("dnd5e", "roll.type") !== "attack" ) return;
    if ( message.getFlag(MODULE_ID, "riposte") ) return;               // never re-stamp
    if ( message.getFlag(MODULE_ID, "riposteFor") ) return;            // a driven attack never chains re-offers
    const entry = maneuverEntries().find(e => e.kind === "riposte");
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
      if ( actor.getFlag(MODULE_ID, "reactionSpent") ) continue;       // one reaction per round
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
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}),
      reactors
    });
    armRiposteTimer(message);
  } catch(err) {
    console.error(`${TITLE} | Riposte stamp failed.`, err);
  }
});

/* Per-reactor answers don't fit armAskTimer's single-answer shape — the topple timer's idiom. */
function armRiposteTimer(message) {
  const flag = message?.getFlag(MODULE_ID, "riposte");
  if ( !flag?.deadline || (flag.status !== "pending") || !isActiveGM() ) return;
  if ( !(flag.reactors ?? []).some(r => !r.answer) ) return;
  if ( riposteTimers.has(message.id) ) return;
  riposteTimers.set(message.id, setTimeout(() => {
    riposteTimers.delete(message.id);
    void fireRiposteTimer(message.id);
  }, Math.max(0, flag.deadline - Date.now())));
}

function disarmRiposteTimer(messageId) {
  const handle = riposteTimers.get(messageId);
  if ( handle === undefined ) return;
  clearTimeout(handle);
  riposteTimers.delete(messageId);
}

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

/** One reactor's answer — claim through the flag lock; "riposte" executes on this client. */
async function answerRiposte(message, uuid, answer, { weaponId = null } = {}) {
  let claimed = false;
  await queueFlagWrite(message, "riposte", current => {
    const r = (current.reactors ?? []).find(x => x.uuid === uuid);
    if ( !r || r.answer || (current.status !== "pending") ) return;
    r.answer = answer;
    r.answeredAt = Date.now();   // the crash-resume horizon (the topple discipline)
    if ( (current.reactors ?? []).every(x => x.answer) ) current.status = "resolved";
    claimed = true;
  });
  if ( !claimed || (answer !== "riposte") ) return;
  await resolveRiposte(message, uuid, weaponId);
}

/** Has this reactor's driven attack already been made? The provenance flags ARE the receipt. */
const riposteDriven = (messageId, uuid) => game.messages.contents.some(m =>
  (m.getFlag(MODULE_ID, "riposteFor") === messageId) && (m.getFlag(MODULE_ID, "riposteBy") === uuid));

/** The accept path: use the maneuver, spend the reaction, arm the die, drive the attack. */
async function resolveRiposte(message, uuid, weaponId) {
  const key = `${message.id}|${uuid}`;
  if ( riposteInFlight.has(key) ) return;
  riposteInFlight.add(key);
  try {
    const flag = message.getFlag(MODULE_ID, "riposte");
    const reactor = flag?.reactors?.find(r => r.uuid === uuid);
    if ( !reactor || (reactor.answer !== "riposte") ) return;
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
      await activity.use({}, { configure: false }, {
        data: { flags: { [MODULE_ID]: { riposteUse: message.id } } }
      });
      if ( inRunningCombat(actor) ) void actor.setFlag(MODULE_ID, "reactionSpent", true);

      // 2. Arm the one-shot die for the injection hook, THEN drive the real attack — the
      //    P3-measured shape: use() for the usage card, rollAttack chained to it, module
      //    provenance in FLAT message data (nested data is invisible to the riders).
      const options = meleeOptions(actor);
      const chosen = options.find(o => o.itemId === weaponId) ?? options[0];
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
    config.rolls.push({
      data: config.rolls[0]?.data ?? {},
      parts: [armed.formula],
      options: { type: armed.type, types: armed.type ? [armed.type] : [] }
    });
  } catch(err) {
    console.error(`${TITLE} | Riposte die injection failed.`, err);
  }
});

/** The Riposte/Pass popup — two controls plus the weapon choice (an input, like the topple
 * bonus field: inputs inform the answer, they are not answers). */
async function showRipostePopup(message, flag, reactor) {
  const actor = (() => { try { return fromUuidSync(reactor.uuid); } catch { return null; } })();
  if ( !canAnswerFor(actor) ) return;
  const key = popupKey(message.id, `riposte:${reactor.uuid}`);
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return; }
  const options = (actor ? meleeOptions(actor) : [])
    .map(o => `<option value="${o.itemId}">${o.label}</option>`).join("");
  let dialog;
  const answer = kind => answerRiposte(message, reactor.uuid, kind, {
    weaponId: dialog?.element?.querySelector('select[name="bf-riposte-weapon"]')?.value ?? null
  });
  dialog = new foundry.applications.api.DialogV2({
    window: { title: `Riposte — ${reactor.name}`, icon: "fa-solid fa-reply" },
    position: { width: 440 },
    content: bfCard({
      img: reactor.itemImg, eyebrow: `Maneuver — ${reactor.itemName}`, tone: "pending",
      title: `${flag.attackerName} missed you`,
      subtitle: "Spend your reaction and a superiority die: strike back, the die joins the damage.",
      lines: []
    }) + `
    <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;">
      <label style="flex:1;font-size:var(--font-size-12,12px);">Riposte with</label>
      <select name="bf-riposte-weapon" style="flex:1;min-width:0;">${options}</select>
    </div>` + holdBarHTML(flag, "to answer"),
    buttons: [
      { action: "riposte", label: "Riposte", default: true, callback: () => answer("riposte") },
      { action: "pass", label: "Pass", callback: () => answer("declined") }
    ],
    rejectClose: false
  });
  await openManagedPopup(key, message, dialog);
}

/* =============================================================================================
 * SHARED PLUMBING — rows, popups on render, answer watcher, cleanup
 * ========================================================================================== */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  // --- Precision: one row on the attack card ------------------------------------------------
  const p = message.getFlag(MODULE_ID, "precision");
  if ( p ) {
    const row = document.createElement("div");
    row.className = "battleflow-maneuver";
    const pending = p.status === "pending";
    row.innerHTML = bfCard({
      img: p.itemImg, eyebrow: `Maneuver — ${p.itemName}`,
      tone: pending ? "pending" : (p.outcome === "used" ? "good" : "neutral"),
      title: pending ? "The attack missed — the maneuver is offered"
        : (p.outcome === "used"
          ? `${p.itemName} used${(p.targets ?? []).some(t => t.verdict === "hit") ? " — now hits" : " — still misses"}`
          : `Passed${p.timedOut ? " (timer)" : ""}`),
      subtitle: (p.targets ?? []).map(t => t.name).join(", ")
    }) + (pending ? holdBarHTML(p, "to answer") : "");
    html.querySelector(".message-content")?.appendChild(row);
    if ( pending ) {
      scheduleBarSync(row);
      armPrecisionTimer(message);
      const attacker = (() => { try { return fromUuidSync(p.attackerUuid); } catch { return null; } })();
      if ( canAnswerFor(attacker) && !p.answer ) {
        if ( !gmQuietFor(attacker) && !shownPrecision.has(message.id) ) {
          shownPrecision.add(message.id);
          void showPrecisionPopup(message, p);
        }
        const recall = document.createElement("button");
        recall.type = "button";
        recall.textContent = "Answer";
        Object.assign(recall.style, { width: "auto", margin: "0.25rem 0 0", padding: "0 0.6rem" });
        recall.addEventListener("click", () => {
          void showPrecisionPopup(message, message.getFlag(MODULE_ID, "precision"));
        });
        row.appendChild(recall);
      }
      // Crash-resume, elect-owned with the topple's 20s horizon: an ACCEPTED answer whose
      // executing client died sits answer="use", still pending. The normal path resolves on
      // the answering client the instant the claim lands; the elect only picks up stale
      // wrecks, so the two can never run the use() twice (resolvePrecision re-checks status
      // and holds an in-flight latch).
      if ( (p.answer === "use") && isActiveGM() && p.answeredAt
        && (Date.now() - p.answeredAt > 20_000) ) void resolvePrecision(message);
    }
  }

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
        title: !reactor.answer ? `${reactor.name} may riposte`
          : (reactor.answer === "riposte" ? `${reactor.name} ripostes`
            : `${reactor.name} declined${reactor.timedOut ? " (timer)" : ""}`),
        subtitle: `${r.attackerName}'s melee attack missed`
      });
      row.appendChild(line);
      if ( pending && !reactor.answer ) {
        const bar = document.createElement("div");
        bar.innerHTML = holdBarHTML(r, "to answer");
        row.appendChild(bar);
        const actor = (() => { try { return fromUuidSync(reactor.uuid); } catch { return null; } })();
        if ( canAnswerFor(actor) ) {
          if ( !gmQuietFor(actor) && !shownRiposte.has(`${message.id}|${reactor.uuid}`) ) {
            shownRiposte.add(`${message.id}|${reactor.uuid}`);
            void showRipostePopup(message, r, reactor);
          }
          const recall = document.createElement("button");
          recall.type = "button";
          recall.textContent = `Answer — ${reactor.name}`;
          Object.assign(recall.style, { width: "auto", margin: "0.25rem 0.25rem 0 0", padding: "0 0.6rem" });
          recall.addEventListener("click", () => {
            const live = message.getFlag(MODULE_ID, "riposte");
            const lr = live?.reactors?.find(x => x.uuid === reactor.uuid);
            if ( live && lr && !lr.answer ) void showRipostePopup(message, live, lr);
          });
          row.appendChild(recall);
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
  const p = message.getFlag(MODULE_ID, "precision");
  if ( p ) {
    const dialog = livePopups.get(popupKey(message.id, "precision"));
    if ( dialog && ((p.status !== "pending") || p.answer) ) void dialog.close();
    if ( p.status !== "pending" ) disarmAskTimer(precisionTimers, message.id);
  }
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

Hooks.on("deleteChatMessage", message => {
  disarmAskTimer(precisionTimers, message.id);
  disarmRiposteTimer(message.id);
  shownPrecision.delete(message.id);
  for ( const key of shownRiposte ) if ( key.startsWith(`${message.id}|`) ) shownRiposte.delete(key);
});
