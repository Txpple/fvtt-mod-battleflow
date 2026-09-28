/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): Precision Attack, the `precision` fold — a missed
 * attack patched by a superiority die. Accepting USES the maneuver, rolls the die publicly,
 * writes per-target verdicts through the fold registry, and re-drives the damage.
 * ⚠ The flag never touches `hold` (one hold per message; any hold verdict is authoritative).
 * ⚠ Offered only when the attack hit NOBODY: one damage roll serves every target.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, queueFlagWrite, canAnswerFor, statContext, decisionWindow } from "./core.js";
import { cardActivity, resolveUuid, usableManeuver, maneuverDieFormula } from "./lookup.js";
import { maneuverFoldEntries } from "./decide/registry.js";
import { hitTargets } from "./shared.js";
import { bfCard, holdBarHTML, spendPhrase, rescueView, rescueSourceFor } from "./decide/present.js";
import { ATTACK_FOLDS, foldsFrom, foldedRoll, foldedVerdict } from "./decide/verdict.js";
import { momentButton, scheduleBarSync, armAskTimer, disarmAskTimer, registerRescue,
  syncRescuePopup } from "./ui.js";
import { offerDamageRoll, rollDamageForAttack } from "./auto-damage.js";
import { SURFACES } from "./surfaces.js";
import { activityUuidOf, masteryOf, originData, targetsOf } from "./decide/card.js";
import { listen } from "./dispatch.js";

const precisionTimers = new Map();
const precisionInFlight = new Set();

/** Stamp: the roller's own client, on the attack message it authored. */
listen("dnd5e.rollAttack", "precision", async (rolls, { subject }) => {
  try {
    if ( !subject || (subject.type !== "attack") ) return;
    const attacker = subject.actor;
    if ( !attacker ) return;
    const attackMessage = rolls?.[0]?.parent;
    if ( !(attackMessage instanceof ChatMessage) ) return;
    if ( attackMessage.getFlag(MODULE_ID, "precision") ) return;      // never re-stamp
    const roll = rolls[0];
    if ( roll.isFumble ) return;                                       // a natural 1 stands
    const entry = maneuverFoldEntries().find(e => e.kind === "precision");
    if ( !entry ) return;
    const found = usableManeuver(attacker, entry.name);
    const raw = found ? maneuverDieFormula(found.activity) : null;
    if ( !found || !raw ) return;
    // ⚠ Resolve the `@scale…` die NOW, against the attacker: an unresolved token silently rolls
    // 0, so a formula with no dice left is refused.
    const resolved = await new Roll(raw, attacker.getRollData()).evaluate();
    const dieFormula = resolved.formula;
    if ( !resolved.dice.length ) {
      console.warn(`${TITLE} | "${entry.name}" resolved to "${dieFormula}" for ${attacker.name} `
        + "— no die left in it, so the offer stays off rather than spending one for nothing.");
      return;
    }

    // Clean misses only: resolvable ACs, every one of them missed.
    const snapshot = targetsOf(attackMessage);
    if ( !snapshot.length || hitTargets(attackMessage).length ) return;
    const judged = snapshot.filter(t => (t.ac !== null) && (t.ac !== undefined));
    if ( !judged.length ) return;                                      // null AC — humans have it

    // The hopeless gate, as the hold's: a maximised die cannot reach the nearest AC. Off while
    // the math is hidden, since skipping would reveal it.
    const margins = judged.map(t => ({ uuid: t.uuid, name: t.name, ac: t.ac, margin: t.ac - roll.total }));
    if ( setting(S.holdReveal) ) {
      const dieMax = (await new Roll(dieFormula, attacker.getRollData()).evaluate({ maximize: true })).total;
      if ( Math.min(...margins.map(m => m.margin)) > dieMax ) return;
    }

    const window = decisionWindow();
    await attackMessage.setFlag(MODULE_ID, "precision", {
      status: "pending",
      itemId: found.item.id, activityId: found.activity.id,
      itemName: found.item.name, itemImg: found.item.img,
      attackerUuid: attacker.uuid, attackTotal: roll.total, dieFormula,
      answer: null,
      ...statContext(attacker.uuid),
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
  let withdrawn = false;
  await queueFlagWrite(message, "precision", current => {
    if ( (current.status !== "pending") || current.answer ) return;
    // ⚠ THE SPEND-GUARD, inside the lock: a sibling fold that already turned the miss into a hit
    // kills the premise; using the maneuver now would spend a die on a hit target.
    if ( (answer === "use") && hitTargets(message).length ) {
      current.status = "resolved";
      current.outcome = "no longer needed";
      withdrawn = true;
      return;
    }
    current.answer = answer;
    current.answeredAt = Date.now();   // the crash-resume horizon
    if ( timedOut ) current.timedOut = true;
    if ( answer !== "use" ) {
      current.status = "resolved";
      current.outcome = timedOut ? "passed (timer)" : "passed";
    }
    claimed = true;
  });
  if ( withdrawn ) {
    disarmAskTimer(precisionTimers, message.id);
    return;
  }
  if ( !claimed || (answer !== "use") ) return;
  await resolvePrecision(message);
}

/** The accept path: use the maneuver, roll the die, verdict, announce, re-drive. */
async function resolvePrecision(message) {
  if ( precisionInFlight.has(message.id) ) return;
  precisionInFlight.add(message.id);   // before the first await
  try {
    const flag = message.getFlag(MODULE_ID, "precision");
    if ( !flag || (flag.answer !== "use") || (flag.status !== "pending") ) return;
    const attacker = await fromUuid(flag.attackerUuid);
    const item = attacker?.items?.get(flag.itemId);
    const activity = item?.system.activities?.get?.(flag.activityId)
      ?? item?.system.activities?.contents?.find(a => a.id === flag.activityId);
    if ( !(attacker instanceof Actor) || !activity ) return;

    // ⚠ The spend-guard again, for the crash-resume caller: the roll may have been fixed since.
    if ( hitTargets(message).length ) {
      await queueFlagWrite(message, "precision", current => {
        if ( current.status !== "pending" ) return false;
        current.status = "resolved";
        current.outcome = "no longer needed";
      });
      return;
    }

    // 1. REALLY use it — use() consumes the pool and posts a card; it rolls nothing.
    await activity.use({ subsequentActions: false }, { configure: false }, {
      data: originData(message.id)   // the 6.0 card's origin (decide/card.js), never the deleted flag
    });

    // 2. The die, public, stamped `respondsTo` so no bare-roll recognizer claims it.
    const dieRoll = new Roll(flag.dieFormula, attacker.getRollData());
    await dieRoll.evaluate();
    await dieRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      flavor: `${flag.itemName} — the superiority die`,
      flags: { [MODULE_ID]: { respondsTo: message.id } }
    });
    const die = dieRoll.total;

    // 3. Verdicts COMPOSED across every fold (a Bardic die may already be added). ⚠ Never
    //    `flag.attackTotal + die`; the pending flag stands in, this die is not on the message yet.
    const pending = { ...flag, status: "resolved", outcome: "used", die };
    const folds = precisionFolds(message, pending);
    const baseRoll = precisionBase(message, flag);

    const lines = [];
    let anyHit = false;
    await queueFlagWrite(message, "precision", current => {
      current.status = "resolved";
      current.outcome = "used";
      current.die = die;
      for ( const t of current.targets ?? [] ) {
        // ⚠ PER TARGET: the registry holds a contribution per (target × spend); summing them
        // all counts every die once per target.
        const mine = folds.filter(f => f.uuid === t.uuid);
        const composed = foldedRoll(baseRoll, mine);
        t.verdict = foldedVerdict(t, baseRoll, folds);
        if ( t.verdict === "hit" ) anyHit = true;
        // A defender's fold (a Shield) can move the AC, so print the composed one.
        const ac = mine.findLast(f => Number.isFinite(f.ac))?.ac ?? t.ac;
        const sum = composed.replaced
          ? `${current.attackTotal} → ${composed.total}`
          : `${current.attackTotal} + ${composed.added} = ${composed.total}`;
        lines.push(`${sum} vs AC ${ac} — `
          + (t.verdict === "hit" ? `<strong>now hits ${t.name}</strong>` : `still misses ${t.name}`));
      }
    });
    // Graze already paid on this miss: announce it, never unwind it.
    if ( (masteryOf(message) === "graze")
      && message.getFlag(MODULE_ID, "receipt")?.targets?.length ) {
      lines.push("⚠ Graze already paid on the miss — revert its receipt if you rule it void.");
    }
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: bfCard({
        img: flag.itemImg, eyebrow: `Maneuver — ${flag.itemName}`,
        tone: anyHit ? "good" : "neutral",
        title: anyHit ? `${flag.itemName} — the miss becomes a hit` : `${flag.itemName} — still a miss`,
        subtitle: spendPhrase([]),   // the usage card the use posted carries the count (resources.js)
        lines
      })
    });

    // 4. The re-drive, as the hold's continuation: the player's own dice, else the straight roll.
    if ( !anyHit || !hitTargets(message).length ) return;
    const attackActivity = cardActivity(message, activityUuidOf(message));
    if ( !attackActivity ) return;
    if ( setting(S.playerRollDamage) ) return void offerDamageRoll(attackActivity, message);
    await rollDamageForAttack(attackActivity, message);
  } catch(err) {
    console.error(`${TITLE} | Precision resolution failed.`, err);
  } finally {
    precisionInFlight.delete(message.id);
  }
}

/** The fold contributions for ONE target; `flag` may be the pending spend, not yet on the message. */
const precisionFolds = (message, flag) => foldsFrom(
  key => ((key === "precision") ? flag : message.getFlag(MODULE_ID, key)), ATTACK_FOLDS)
  .filter(f => f.uuid === flag?.targets?.[0]?.uuid);

/** The roll the folds compose over — the real d20 where there is one, the stamp's copy otherwise. */
const precisionBase = (message, flag) => message.rolls?.[0] ?? { total: flag?.attackTotal };

/** PRECISION AS A RESCUE ROW (ARCHITECTURE §5): a d20 fold on the same roll shares its window. */
registerRescue("precision", {
  isPending: message => message.getFlag(MODULE_ID, "precision")?.status === "pending",
  subject: message => {
    const uuid = message.getFlag(MODULE_ID, "precision")?.attackerUuid;
    return resolveUuid(uuid);
  },
  // Composed here, not in the spine: ui.js reads no world setting and imports no machine.
  view: message => {
    const flag = message.getFlag(MODULE_ID, "precision");
    if ( !flag ) return null;
    return rescueView(key => ((key === "precision") ? flag : null), {
      composed: foldedRoll(precisionBase(message, flag), precisionFolds(message, flag)),
      reveal: setting(S.holdReveal),
      sources: rescueSourceFor("precision")
    });
  },
  // `use` is the row; `pass` is the footer, sent to every source.
  answer: (message, action) => answerPrecision(message, (action === "use") ? "use" : "pass")
});

/** THE MOOT: a sibling spend fixed the roll; this offer withdraws, spending nothing. Elect-owned. */
async function mootPrecision(message) {
  await queueFlagWrite(message, "precision", current => {
    if ( (current.status !== "pending") || current.answer ) return false;   // someone answered
    current.status = "resolved";
    current.outcome = "no longer needed";
  });
  disarmAskTimer(precisionTimers, message.id);
}

// The row on the attack card, the watcher, the cleanup.

listen("dnd5e.renderChatMessage", "precision", (message, html) => {
  const p = message.getFlag(MODULE_ID, "precision");
  if ( p ) {
    const row = document.createElement("div");
    row.className = "battleflow-maneuver";
    const pending = p.status === "pending";
    row.innerHTML = bfCard({
      img: p.itemImg, eyebrow: `Maneuver — ${p.itemName}`,
      tone: pending ? "pending" : (p.outcome === "used" ? "good" : "neutral"),
      title: pending ? `${p.itemName} — offered: the attack missed`
        : (p.outcome === "used"
          ? `${p.itemName} — used${(p.targets ?? []).some(t => t.verdict === "hit") ? ", now hits" : ", still misses"}`
          : (p.outcome === "no longer needed")
            ? `${p.itemName} — no longer needed; nothing spent`
            : `${p.itemName} — passed${p.timedOut ? " (timer)" : ""}`),
      subtitle: (p.targets ?? []).map(t => t.name).join(", ")
    }) + (pending ? holdBarHTML(p, "to answer") : "");
    html.querySelector(SURFACES.messageContent)?.appendChild(row);
    if ( pending ) {
      scheduleBarSync(row);
      armPrecisionTimer(message);
      const attacker = resolveUuid(p.attackerUuid);
      if ( canAnswerFor(attacker) && !p.answer ) {
        // `recall` lets a human reopen a window they closed.
        syncRescuePopup(message);
        row.appendChild(momentButton("Answer", () => {
          syncRescuePopup(message, { recall: true });
        }, { margin: "0.25rem 0 0" }));
      }
      // Crash-resume, elect-owned, 20s horizon: an accepted answer whose client died. Only
      // stale wrecks, so use() never runs twice.
      if ( (p.answer === "use") && isActiveGM() && p.answeredAt
        && (Date.now() - p.answeredAt > 20_000) ) void resolvePrecision(message);
    }
  }
});

// Every client closes answered popups; the timers disarm when nothing is pending.
listen("updateChatMessage", "precision", message => {
  const p = message.getFlag(MODULE_ID, "precision");
  if ( p ) {
    // The premise is re-derived every update: once any fold makes it a hit, the offer goes.
    if ( (p.status === "pending") && !p.answer && isActiveGM() && hitTargets(message).length ) {
      void mootPrecision(message);
    }
    // ⚠ SYNC, DO NOT CLOSE: the window is shared, and closing it would take a sibling's live
    // offer with it. The spine closes it when nothing is left asking.
    if ( (p.status !== "pending") || p.answer ) syncRescuePopup(message);
    if ( p.status !== "pending" ) disarmAskTimer(precisionTimers, message.id);
  }
});

// The shown-latches ride ui.js's one delete-sweep; only this machine's clock disarms here.
listen("deleteChatMessage", "precision", message => {
  disarmAskTimer(precisionTimers, message.id);
});
