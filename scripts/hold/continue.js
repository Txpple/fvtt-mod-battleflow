// @ts-check
/**
 * Battle Flow — the reaction hold: THE CONTINUATION. Every held target answered → re-test against
 * the LIVE AC after the settle window, write the verdicts, announce, release the dice. Also closes
 * answered popups (the parts stay a DAG: views → continue, never back).
 */
import { MODULE_ID, TITLE, queueFlagWrite, isContinuingClient, drivesMomentFor, canApplyTo, HOLD_SETTLE_SECONDS } from "../core.js";
import { chipClock } from "../decide/chips.js";
import { placeOf, chipData } from "../shared.js";
import { applyEffectsTo } from "../effect-riders.js";
import { foldedRoll, interruptMultiplier } from "../decide/verdict.js";
import { INTERRUPT_MULTIPLIERS, INTERRUPT_ROLLS } from "../decide/registry.js";
import { rescueSpendText } from "../decide/rescue-hit.js";
import { damageAfterHold } from "../auto-damage.js";
import { joinEffectReceipt } from "../decide/receipt.js";
import { bfCard, popupKey, spendPhrase, esc } from "../decide/present.js";
import { livePopups, waitForWrite } from "../ui.js";
import { reactionItem, hasReactionEffect, applyReactionEffect, reactionACArrived, reactionImg, duplicatesOf, attackFactsOf } from "./lookup.js";
import { duplicateOutcome, duplicateWords } from "../decide/duplicates.js";
import { disarmHoldTimer } from "./clock.js";
import { resolveUuid, lower } from "../lookup.js";
import { continueSpellHold } from "./spell-hold.js";
import { listen } from "../dispatch.js";

// ⚠ Reads CURRENT state, not the diff: setFlag's flattened key never matches a nested test.
listen("updateChatMessage", "hold/continue", message => {
  // Every client, before the continuing-client gate: the popup is usually elsewhere.
  closeAnsweredHoldPopups(message);

  const hold = message.getFlag(MODULE_ID, "hold");
  if ( hold?.status === "resolved" ) { void landProtection(message, hold); void landDuplicates(message, hold); }
  if ( !hold || (hold.status !== "pending") || !isContinuingClient(hold) ) return;
  if ( !hold.targets.every(t => t.answer) ) return;
  void continueHold(message);
});

/**
 * Write a continuation's resolved hold under the lock. False when the hold was no longer pending
 * (resolved elsewhere): the caller's announcements are then someone else's to make.
 * @param {any} message
 * @param {any} hold  the clone this continuation judged, `status` already "resolved"
 */
async function writeResolvedHold(message, hold) {
  let wrote = false;
  await queueFlagWrite(message, "hold", live => {
    if ( live.status !== "pending" ) return false;
    Object.assign(live, hold);
    wrote = true;
  });
  return wrote;
}

/**
 * ⚠ Claimed before the first await: the settle wait re-fires the watcher, and a second run rolls
 * damage twice. In memory, so a client dying mid-run cannot strand the hold.
 */
const continuationsInFlight = new Set();

/** Re-resolve a fully-answered hold against the LIVE AC (Shield's +5 must land first). */
export async function continueHold(attackMessage) {
  if ( continuationsInFlight.has(attackMessage.id) ) return;
  const hold = foundry.utils.deepClone(attackMessage.getFlag(MODULE_ID, "hold"));
  if ( !hold || (hold.status !== "pending") ) return;
  continuationsInFlight.add(attackMessage.id);
  try {
    return await driveHoldContinuation(attackMessage, hold);
  } finally {
    continuationsInFlight.delete(attackMessage.id);
  }
}

/** C1 — the INTERRUPT_MULTIPLIERS row whose effect is typed (`effects: "type"`), or null. */
const typedEffectRow = name => {
  const key = Object.keys(INTERRUPT_MULTIPLIERS).find(k => lower(k) === lower(name ?? ""));
  return (key && (INTERRUPT_MULTIPLIERS[key].effects === "type")) ? INTERRUPT_MULTIPLIERS[key] : null;
};

async function driveHoldContinuation(attackMessage, hold) {

  // Safety net: the cast reaction's effect must be ON the actor before the re-test. ⚠ Catches only
  // what this client OWNS; the monster side rests on the answering GM's applyReactionEffect.
  for ( const target of hold.targets.filter(t => t.answer === "cast") ) {
    const actor = await fromUuid(target.uuid);
    if ( !actor?.isOwner || hasReactionEffect(actor, target.reaction, target) ) continue;
    if ( typedEffectRow(target.reaction) ) continue;   // C1 — its one typed effect lands with the share, not here
    // The ITEM, by recorded itemId: a statblock's Shield keeps its effect only on the item.
    const item = reactionItem(actor, target.reaction, target);
    const activity = item?.system.activities?.contents?.[0];
    const entries = await applyReactionEffect(activity, actor, target.reaction, target);
    if ( entries.length ) {
      await queueFlagWrite(attackMessage, "effectReceipt", flag => {
        for ( const entry of entries ) joinEffectReceipt(flag, entry);
      });
    }
  }

  // A negate hold has nothing to re-test.
  if ( hold.trigger === "spell" ) return continueSpellHold(attackMessage, hold);

  if ( hold.targets.some(t => t.answer === "cast") ) await settleForACChange(hold);

  const roll = attackMessage.rolls[0];
  const announcements = [];
  for ( const target of hold.targets ) {
    const actor = await fromUuid(target.uuid);
    const liveAC = actor?.system?.attributes?.ac?.value ?? target.ac;
    // A `roll` answer's bent d20 is a `replace` with its own crit/fumble: fold it, never the raw total.
    const rolled = foldedRoll({ total: roll.total, isCritical: roll.isCritical, isFumble: roll.isFumble },
      bentFold(target));
    const hit = rolled.isCritical || (!rolled.isFumble && (rolled.total >= liveAC));
    target.verdict = hit ? "hit" : "miss";
    target.acAtVerdict = liveAC;
    if ( target.answer === "roll" ) {
      announcements.push(bentAnnouncement(actor, target, hit, !!hold.miss));
      continue;
    }
    if ( target.answer !== "cast" ) continue;
    const img = reactionImg(actor, target.reaction, target);
    if ( target.kind === "ac" ) {
      if ( !reactionACArrived(actor, target) ) {
        // ⚠ A FIXED AC (`ac.override` or `calc: "flat"`) ignores every AC bonus: a statblock to fix.
        const ac = actor?.system?.attributes?.ac;
        const flatAC = ((ac?.override !== null) && (ac?.override !== undefined) || (ac?.calc === "flat"))
          && hasReactionEffect(actor, target.reaction, target);
        announcements.push(bfCard({
          img, eyebrow: "Reaction — not applied", title: target.reaction, subtitle: target.name,
          tone: "bad",
          lines: flatAC
            ? [`<strong>${esc(target.name)}</strong>'s AC is a <strong>fixed number</strong>, so no `
              + `bonus can reach it — ${target.reaction}'s included.`,
              `The effect did land; the system ignores it. AC reads <strong>${liveAC}</strong>, `
              + `so this resolves as a hit (${roll.total}).`,
              `<em>Fix the statblock: set its AC calculation to Natural Armor with the same `
              + `number, and the reaction works.</em>`]
            : [`It was cast, but its AC has not arrived on <strong>${esc(target.name)}</strong>.`,
              `AC still reads <strong>${liveAC}</strong>, so this resolves as a hit (${roll.total}).`,
              `<em>Apply the effect from the card, then Revert the damage if needed.</em>`]
        }));
      } else {
        announcements.push(bfCard({
          img, eyebrow: hit ? "Reaction — not enough" : "Reaction — it worked",
          title: target.reaction, subtitle: target.name, tone: hit ? "bad" : "good",
          lines: [`AC <strong>${target.ac}</strong>`
            + `${liveAC !== target.ac ? ` → <strong>${liveAC}</strong>` : ""}`
            + ` vs the attack's <strong>${roll.total}</strong>.`,
            hit ? `The attack still hits.` : `<strong>The attack misses.</strong>`]
        }));
      }
    } else {
      // A damage-kind reaction the module can settle (halve, rolled reduction) is receipted; the rest by hand.
      const settled = interruptMultiplier(target, INTERRUPT_MULTIPLIERS);
      const reduced = (Number(target.reduceBy) > 0) ? Number(target.reduceBy) : null;
      const how = settled ? ((settled.multiplier === 0.5) ? "halved" : `×${settled.multiplier}`) : reduced ? `reduced by <strong>${reduced}</strong>` : null;
      const maneuver = !!target.reduce;
      const r = target.reduce ?? {};
      announcements.push(bfCard({
        img, eyebrow: maneuver ? `${r.eyebrow ?? "Maneuver"} — ${target.reaction}` : (settled || reduced) ? "Reaction — it worked" : "Reaction — cast",
        title: maneuver ? (reduced ? `${target.reaction} — ${target.name} reduces the damage by ${reduced}` : `${target.reaction} — reduce the damage by hand`) : target.reaction,
        subtitle: maneuver ? spendPhrase(target.poolSpend ? [target.poolSpend] : [], r.spend ?? "Superiority Die") : target.name,
        tone: (settled || reduced) ? "good" : "neutral",
        lines: [(settled || reduced)
          ? `The attack still hits, and its damage against <strong>${esc(target.name)}</strong> is ${how} — the receipt says so.`
          : `Reduce the damage by hand — the roll stands.`]
      }));
    }
  }

  // THE DUPLICATES (Mirror Image), rolled on a hit that STILL stands — after the defender's reactions, so a
  // Shield or a Lucky that turned it rolls nothing (ruled, the prototype's C5).
  for ( const target of hold.targets ) {
    if ( !target.duplicates || (target.verdict !== "hit") ) continue;
    const said = await rollDuplicates(attackMessage, target);
    if ( said ) announcements.push(said);
  }

  hold.status = "resolved";
  disarmHoldTimer(attackMessage.id);
  // The verdicts, through the serializer: a fold still queued on this client lands first, and a
  // hold another client resolved meanwhile is not re-announced.
  if ( !await writeResolvedHold(attackMessage, hold) ) return;
  if ( announcements.length ) await ChatMessage.create({
    content: announcements.join(`<div style="height:0.3rem;"></div>`),
    speaker: { alias: TITLE }
  });

  // Release the dice rolled at attack time; the applier's hitTargets drops every flipped target.
  for ( const dmg of game.messages.contents.filter(m =>
    (m.getFlag(MODULE_ID, "attackFor") === attackMessage.id)
    && (m.getFlag(MODULE_ID, "attackHoldPending") === true) ) ) {
    await dmg.setFlag(MODULE_ID, "attackHoldPending", false);
  }

  // A crit the hold could undo was never rolled, nor a miss a bystander turned: roll it now, as the answer left it.
  if ( hold.critAtStake || (hold.miss && hold.targets.some(t => t.verdict === "hit")) ) await damageAfterHold(attackMessage);
}

/**
 * A die per standing duplicate, rolled in the open; any face at `at` or higher redirects the hit to one
 * of them: the entry's verdict becomes "absorbed" (the applier drops it), the LAST duplicate is the one
 * destroyed, landed by the defender's driver (`landDuplicates`). Returns the announcement card, or null.
 */
async function rollDuplicates(attackMessage, target) {
  try {
    const actor = resolveUuid(target.uuid);
    const attacker = attackMessage.getAssociatedActor?.() ?? null;
    const live = duplicatesOf(actor, attacker, attackFactsOf(attackMessage));   // re-read: a duplicate may have gone since the stamp
    const d = target.duplicates;
    if ( !live || live.seenThrough || !live.count ) { target.duplicates = { ...d, faces: [], absorbed: false, left: live?.count ?? 0, gone: true }; return null; }
    // C1 — a `save` row (Unbreakable Majesty): the ATTACKER's save against the defender's DC; a failure turns the hit aside.
    if ( live.save ) {
      const s = live.save;
      let total = null;
      try {
        const rolls = await attacker.rollSavingThrow({ ability: s.ability, target: s.dc }, { configure: false },
          { data: { flags: { [MODULE_ID]: { duplicatesSave: { key: live.key, defenderUuid: actor.uuid, attackerUuid: attacker.uuid, dc: s.dc } } } } });
        const t = Number(rolls?.[0]?.total);
        total = Number.isFinite(t) ? t : null;
      } catch(err) { console.error(`${TITLE} | ${live.key}'s save did not roll — judge the hit by hand.`, err); }
      const absorbed = (total !== null) && (total < s.dc);
      const effect = actor.effects.get(s.effectId);
      if ( effect && s.turn && attacker?.uuid ) await effect.setFlag(MODULE_ID, "recoiled", { ...(effect.getFlag(MODULE_ID, "recoiled") ?? {}), [attacker.uuid]: s.turn }).catch(() => {});
      target.duplicates = { ...d, faces: [], winner: null, absorbed, took: null, left: 1, of: 1, at: null, die: null, feature: true,
        save: { ability: s.ability, dc: s.dc, total } };
      if ( absorbed ) target.verdict = "absorbed";
      const label = CONFIG.DND5E.abilities[s.ability]?.label ?? s.ability;
      return bfCard({ img: live.img, eyebrow: live.key, title: absorbed ? `${live.key} — the attack misses instead` : `${live.key} — the hit stands`,
        subtitle: target.name, tone: absorbed ? "good" : "bad",
        lines: [`${esc(attacker.name)}'s ${esc(label)} save: ${(total === null) ? "unrolled" : `${total} vs DC ${s.dc}`} — ${absorbed ? "<strong>failed</strong>, the attack recoils" : "<strong>made</strong>"}`,
          "once per turn per attacker; the Majestic Presence stands"] });
    }
    const roll = await new Roll(`${live.count}d${live.die}`).evaluate();
    const faces = roll.dice[0]?.results?.map(r => Number(r.result)) ?? [];
    const outcome = duplicateOutcome({ at: Number(live.at) }, faces);
    // A feature row's one "duplicate" is never destroyed (the carapace stands); a face at `reflectAt` also reflects.
    const took = (outcome.absorbed && !live.feature) ? { id: live.ids.at(-1), name: live.names.at(-1) } : null;
    const left = (outcome.absorbed && !live.feature) ? live.count - 1 : live.count;
    const reflectAt = Number(live.reflectAt ?? Number.NaN);
    const reflected = !!live.feature && Number.isFinite(reflectAt) && faces.some(f => f >= reflectAt);
    const words = duplicateWords({ key: live.key, die: Number(live.die), at: Number(live.at) }, outcome, { took: took?.name ?? null, left, of: live.of, feature: !!live.feature, reflected });
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: live.feature ? `${live.key} — a d${live.die}` : `${live.key} — a d${live.die} for each duplicate` });
    target.duplicates = { ...d, faces, winner: outcome.winner, absorbed: outcome.absorbed, took, left, of: live.of, at: live.at, die: live.die,
      ...(live.feature ? { feature: true, reflected } : {}) };
    if ( outcome.absorbed ) target.verdict = "absorbed";
    return bfCard({ img: live.img, eyebrow: live.key, title: words.title, subtitle: target.name, tone: outcome.absorbed ? "good" : "bad",
      lines: [words.dice, words.count] });
  } catch(err) {
    console.error(`${TITLE} | ${target?.duplicates?.key ?? "The duplicates"} could not roll — judge the hit by hand.`, err);
    return null;
  }
}

/** The destroyed duplicate leaves the sheet, once, by the defender's driver (the platform floats its name). */
const duplicatesLanding = new Set();
async function landDuplicates(message, hold) {
  for ( const target of (hold.targets ?? []) ) {
    const d = target.duplicates;
    if ( !d?.absorbed || !d.took?.id || d.landed ) continue;
    const key = `${message.id}|${target.uuid}`;
    if ( duplicatesLanding.has(key) || !drivesMomentFor(target.uuid) ) continue;
    const actor = resolveUuid(target.uuid);
    if ( !(actor instanceof Actor) || !canApplyTo(actor) ) continue;
    duplicatesLanding.add(key);
    try {
      const effect = actor.effects.get(d.took.id);
      if ( effect ) await effect.delete();
      if ( message.isOwner ) await queueFlagWrite(message, "hold", h => {
        const t = h.targets?.find(x => x.uuid === target.uuid);
        if ( !t?.duplicates || t.duplicates.landed ) return false;
        t.duplicates.landed = true;
      });
    } catch(err) {
      console.error(`${TITLE} | ${d.key}'s destroyed duplicate could not leave ${target.name} — remove "${d.took.name}" by hand.`, err);
    }
  }
}

/**
 * Protection's standing half (RULINGS *The fighting styles*): "Protected — <guard>" until the GUARD's
 * next turn starts, landed once by the protected creature's driver.
 */
const protectionsLanding = new Set();
async function landProtection(message, hold) {
  for ( const target of (hold.targets ?? []) ) {
    const by = target.guardedBy;
    if ( !by || (target.answer !== "roll") || target.protectLanded ) continue;
    const key = `${message.id}|${target.uuid}`;
    if ( protectionsLanding.has(key) || !drivesMomentFor(target.uuid) ) continue;
    const defender = resolveUuid(target.uuid), guard = resolveUuid(by.uuid);
    const rowKey = Object.keys(INTERRUPT_ROLLS).find(k => lower(k) === lower(target.rescue ?? ""));
    const row = rowKey ? INTERRUPT_ROLLS[rowKey] : null;
    if ( !row?.effect || !(defender instanceof Actor) || !(guard instanceof Actor) || !canApplyTo(defender) ) continue;
    protectionsLanding.add(key);
    try {
      const item = guard.items.get(by.itemId);
      const effects = (item?.effects?.contents ?? []).filter(e => !e.transfer && (lower(e.name) === lower(row.effect)))
        .map(e => e.clone({ name: `${e.name} — ${by.name}` }, { keepId: true }));
      if ( !effects.length ) continue;
      const clock = chipClock("reaction", placeOf(guard));
      const entries = await applyEffectsTo([{ uuid: defender.uuid, name: target.name }], effects, {
        matchNames: true, source: guard.uuid,
        clock: clock?.start ? chipData(clock) : null,
        extraFlags: { [MODULE_ID]: { protectedBy: guard.uuid } }
      });
      if ( message.isOwner ) {
        await queueFlagWrite(message, "hold", h => {
          const t = h.targets?.find(x => x.uuid === target.uuid);
          if ( !t || t.protectLanded ) return false;
          t.protectLanded = true;
        });
        if ( entries.length ) await queueFlagWrite(message, "effectReceipt", flag => {
          for ( const entry of entries ) joinEffectReceipt(flag, entry);
        });
      }
    } catch(err) {
      console.error(`${TITLE} | ${rowKey}'s standing Disadvantage could not land on ${target.name} — apply "${row.effect}" by hand.`, err);
    }
  }
}

/** A target's bent roll as `foldedRoll`'s contribution. */
function bentFold(target) {
  const b = target?.bent;
  return Number.isFinite(b?.total)
    ? [{ uuid: target.uuid, replace: { total: b.total, isCritical: b.isCritical === true, isFumble: b.isFumble === true } }]
    : [];
}

/** The defender's card after a `roll` answer: the row, its cost, whether it turned the hit. */
function bentAnnouncement(actor, target, hit, miss = false) {
  const found = Object.keys(INTERRUPT_ROLLS).find(k => k.toLowerCase() === String(target.rescue ?? "").toLowerCase());
  const row = found ? INTERRUPT_ROLLS[found] : null;
  const spend = rescueSpendText({ row, poolSpend: target.poolSpend ?? null });
  const by = target.guardedBy ?? null;
  const guardImg = by ? (resolveUuid(by.uuid)?.items?.get(by.itemId)?.img ?? null) : null;
  const bystander = !!(target.guards ?? []).find(g => (g.uuid === by?.uuid) && g.bystander);
  const reduced = Number(target.reduceBy) > 0 ? Number(target.reduceBy) : 0;
  const outcome = (reduced && !target.bent) ? `The hit stands; its damage to <strong>${esc(target.name)}</strong> is reduced by <strong>${reduced}</strong>.`
    : miss ? (hit ? "<strong>The attack hits.</strong>" : "It did not turn the miss.")
    : hit ? "It did not turn the hit." : "<strong>The attack misses.</strong>";
  return bfCard({
    img: guardImg ?? reactionImg(actor, target.rescue ?? target.reaction, {}), eyebrow: `Reaction — ${target.rescue ?? target.reaction}`,
    title: target.rescue ?? target.reaction, subtitle: by ? `${by.name} ${bystander ? "bends the roll against" : "protects"} ${target.name}` : target.name,
    tone: miss ? (hit ? "good" : "bad") : ((hit && !reduced) ? "bad" : "good"),
    lines: [spend, outcome].filter(Boolean)
  });
}

/**
 * Wait for every cast reaction's AC to ARRIVE (a baseline compare can race the recompute): the
 * reactor's client lands the effect, and the recompute follows it on the actor.
 * @param {any} hold
 */
async function settleForACChange(hold) {
  const casts = hold.targets.filter(t => t.answer === "cast");
  await waitForWrite(() => casts.every(target => reactionACArrived(resolveUuid(target.uuid), target)),
    { ms: HOLD_SETTLE_SECONDS * 1000, on: ["createActiveEffect", "updateActiveEffect", "updateActor"] });
}

/** ARCHITECTURE §5 law 4: a decision made ANYWHERE closes its popup — per target. */
function closeAnsweredHoldPopups(message) {
  const hold = message.getFlag(MODULE_ID, "hold");
  if ( !hold?.targets?.length ) return;
  for ( const target of hold.targets ) {
    const dialog = livePopups.get(popupKey(message.id, target.uuid));
    if ( dialog && ((hold.status !== "pending") || target.answer || target.selfPassed) ) void dialog.close();
    // A guard's own popup (Protection) also closes on its own pass.
    for ( const guard of (target.guards ?? []) ) {
      const own = livePopups.get(popupKey(message.id, `${target.uuid}|${guard.uuid}`));
      if ( own && ((hold.status !== "pending") || target.answer || guard.passed) ) void own.close();
    }
  }
}
