/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): weapon mastery riders — the payouts, the mastery
 * ask, the reminders and the Cleave arm. topple.js owns the `topple` flag's lifecycle;
 * chip-spend.js owns the spend, the expiry tidy and the combat sweep.
 */
import { MODULE_ID, TITLE, S, setting, drivesMomentFor,
  canApplyTo, whisperNoGM, queueFlagWrite, canAnswerFor, combatStamp, activeCombatFor,
  statContext } from "./core.js";
import { resolveUuid } from "./lookup.js";
import { effectRecord, joinEffectReceipt, takenOf } from "./decide/receipt.js";
import { MASTERY_KINDS, MASTERY_NATIVE, MASTERY_RULES } from "./decide/registry.js";
import { CHIP_FLAG, chipClock, chipIsDead } from "./decide/chips.js";
import { chipData, chitStampOf, hitTargets, masteryLabel, modeAllows, placeOf, turnPlace } from "./shared.js";
import { popupKey, bfCard, holdBarHTML, momentBarHTML, ruleLine } from "./decide/present.js";
import { livePopups, openMomentPopup, momentButton, scheduleBarSync, shownMoments, acknowledgeMoment, momentAcknowledged, armAskTimer, disarmAskTimer } from "./ui.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { registerOfferPart } from "./auto-damage.js";
import { messageActivity } from "./effect-riders.js";
import { SURFACES } from "./surfaces.js";
import { CARD, isCard, masteryOf, targetsOf } from "./decide/card.js";

/* ---------------------------------------------------------------------------------------------
 * The system stamps the mastery used onto the attack message (`masteryOf`), and only when the
 * wielder has it with that weapon, so eligibility is pre-solved. Masteries live on character
 * actors only, so the ask's owner is always the attacking player.
 *
 *   Vex, Sap        automatic — an authored chip.
 *   Slow            "you can", needs damage dealt — an authored −10 speed chip.
 *   Topple          "you can" — a card with the native [[/save]] and a GM prone button.
 *   Push            "you can" — announce only; tokens are never moved.
 *   Graze           pays on a MISS — ability-mod damage, receipt on the ATTACK card.
 *   Cleave          a reminder plus an optional arm; Nick stays native (action economy).
 *
 * Nothing here modifies a d20 (DESIGN R1): the chip is the reminder, the roll dialog honours it.
 * Chip windows are v14 expiry data (RULINGS
 * *Chips and clocks*). The ask is a miniature hold: a `mastery` flag, a Use/Pass popup where
 * canAnswerFor the attacker, the answer as a flag flip, the elect executes; expiry = Pass.
 * ------------------------------------------------------------------------------------------- */

/** Masteries already warned about — once per session, not once per swing. */
const warnedMasteries = new Set();

/** The authored payout effects. Nothing ships these — the system's masteries are labels. */
const MASTERY_EFFECTS = {
  vex: {
    name: "Vexed", img: "icons/svg/target.svg",
    description: attacker => `${attacker.name} has Advantage on their next attack roll against this creature (Vex, before the end of ${attacker.name}'s next turn).`
  },
  sap: {
    name: "Sapped", img: "icons/svg/downgrade.svg",
    description: attacker => `Disadvantage on its next attack roll (Sap, before the start of ${attacker.name}'s next turn).`
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

/** Attacker, weapon and attack ability behind an attack message — or null. */
function masteryContext(attackMessage) {
  const activity = messageActivity(attackMessage);
  const weapon = activity?.item;
  const attacker = weapon?.actor;
  if ( !activity || !weapon || !attacker ) return null;
  return { activity, weapon, attacker, ability: activity.ability || "str" };
}

/**
 * What this target TOOK from the damage roll — the Vex/Slow "dealt damage" gate. The receipt
 * when auto-apply ran; otherwise the roll total, which cannot see a target's immunity.
 */
function dealtFor(damageMessage, uuid) {
  const entry = damageMessage?.getFlag(MODULE_ID, "receipt")?.targets?.find(t => t.uuid === uuid);
  if ( entry ) return takenOf(entry);
  return damageMessage?.rolls?.reduce((n, r) => n + r.total, 0) ?? 0;
}

/** Route a hit's mastery to its payout or its ask. Runs on the elect, after application. */
export async function resolveHitMastery(damageMessage, attackMessage, hits) {
  try {
    const key = masteryOf(attackMessage);
    if ( !key ) return;
    const ctx = masteryContext(attackMessage);
    if ( !ctx ) return;

    // The dead are skipped — except for Cleave, whose reminder is about the attacker's next
    // swing: a kill is exactly when it matters.
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
        // A reminder, not a payout (ARCHITECTURE.md §6): the extra attack stays native. Once per
        // turn via a chit on the attacker; out of combat every hit reminds.
        if ( !struck.length ) return;
        if ( await cleaveChitStands(ctx) ) return;
        // `struck`, not `live` — the corpse still anchors "within 5 feet of".
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
        // Nick is native by design. ⚠ Anything else is a mastery the system added that this
        // module has never seen — warn loudly (the DESIGN R4 tripwire), never swallow it.
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

// Graze pays on the MISS, where no damage message exists, so it hangs on the attack message.
// It reads the attack as rolled: a later Shield turning a hit to a miss does not re-open Graze
// (RULINGS *Where the table bends the rule*).
Hooks.on("createChatMessage", message => {
  if ( !setting(S.masteryRiders) ) return;
  if ( !isCard(message, CARD.attack) ) return;
  if ( masteryOf(message) !== "graze" ) return;
  if ( !drivesMomentFor(masteryContext(message)?.attacker?.uuid ?? null) ) return;
  void resolveMissMastery(message);
});

async function resolveMissMastery(attackMessage) {
  try {
    const ctx = masteryContext(attackMessage);
    if ( !ctx ) return;
    // Graze alone rides the RESOLVER mode: a miss has no damage button, so with the resolver
    // off there is no manual path, and paying anyway would apply damage the table did not ask for.
    if ( !modeAllows(ctx.attacker) ) return;
    if ( (ctx.attacker.system.abilities?.[ctx.ability]?.mod ?? 0) <= 0 ) return;

    const hitSet = new Set(hitTargets(attackMessage).map(t => t.uuid));
    const missed = [];
    for ( const t of targetsOf(attackMessage) ) {
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
 * Apply one authored mastery chip to each target and join the effect receipt. A same-origin
 * copy (this weapon) is refreshed, never stacked. Not routed through applyEffectsTo: these
 * chips are authored data with no source document, keyed on the mastery flag + weapon origin.
 */
async function applyMasteryEffect(receiptMessage, ctx, key, targets) {
  const def = MASTERY_EFFECTS[key];
  if ( !def ) return;
  // ⚠ The chip is a write to the monster; with no GM connected it cannot be made. The reminder
  // card still posts, which for Vex and Sap is nearly the whole feature.
  const blocked = targets.filter(t => {
    try { return !canApplyTo(t.actor ?? fromUuidSync(t.uuid)); } catch { return true; }
  });
  if ( blocked.length === targets.length ) {
    return whisperNoGM(`the ${masteryLabel(key)} chip on ${blocked.map(t => t.name).join(", ")}`,
      "The reminder card still stands, and the gate still meets the next roll.");
  }
  // ⚠ The clock is pinned to the ATTACKER's combatant explicitly: the platform judges expiry
  // against `start.combatant`, and its own stamp is whoever's turn it is — wrong for an
  // opportunity attack. `placeOf` reads `activeCombatFor`: a chip clocked against a combat that is
  // not `game.combat` is born Unavailable, so out of that combat there is no clock at all.
  const clock = chipClock(key, placeOf(ctx.attacker));
  if ( !clock ) return;
  // ⚠ Entries accumulate locally and merge inside the serializer at the end — reading the flag
  // before the per-target awaits would let another chip writer be overwritten.
  const context = statContext(ctx.attacker.uuid); // the data-plane stamp, once per payout
  const entries = [];
  for ( const t of targets ) {
    const actor = (t.actor instanceof Actor) ? t.actor : await fromUuid(t.uuid);
    if ( !(actor instanceof Actor) ) continue;

    // Sweep this actor's dead chips before adding one: an expired chip stays on the sheet under
    // Unavailable Effects forever and hides the live one. Dead = `chipIsDead`; a chip with no
    // clock is left alone.
    // ⚠ ONE batched delete: a synthetic (unlinked-token) actor rebuilds its collections from
    // the delta on every write, so deleting one at a time throws on the second (NOTES §1).
    const dead = actor.effects.filter(e => e.getFlag(MODULE_ID, CHIP_FLAG) && chipIsDead(e.duration ?? {}));
    if ( dead.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", dead.map(e => e.id));

    const existing = actor.effects.find(e =>
      (e.getFlag(MODULE_ID, CHIP_FLAG) === key) && (e.origin === ctx.weapon.uuid));
    let applied;
    if ( existing ) {
      // ⚠ `?? existing`: Document#update returns UNDEFINED on an empty diff (a re-clock that
      // changes nothing), and the receipt entry must still be written. The re-clock rewrites
      // `start` too: a refreshed window runs from THIS swing.
      applied = (await existing.update({ ...chipData(clock), disabled: false })) ?? existing;
    } else {
      applied = await ActiveEffect.implementation.create({
        name: def.name, img: def.img,
        description: def.description(ctx.attacker),
        origin: ctx.weapon.uuid, disabled: false, transfer: false,
        ...chipData(clock),
        changes: def.changes?.() ?? [],
        flags: { [MODULE_ID]: { [CHIP_FLAG]: key } }
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

/**
 * Does a Cleave chit already stand on the attacker this turn? If not, write one and answer
 * false (remind). Counts only for a combatant in the running combat (RULINGS *The gate before
 * the roll*); a chit nobody can write just means the reminder repeats.
 *
 * ⚠ The chit lives by STAMP COMPARISON with the running turn (`combatStamp`), not by the
 * platform's `expired` mark: that mark is GM-written, so on a no-GM table a mark-based chit
 * would stand forever. The `turnEnd` expiry is only the tidy that removes the document.
 */
async function cleaveChitStands(ctx) {
  const attacker = ctx.attacker;
  const chits = attacker.effects.filter(e => e.getFlag(MODULE_ID, CHIP_FLAG) === "cleave");
  if ( !activeCombatFor(attacker) ) return false;
  const stamp = combatStamp();
  if ( stamp && chits.some(e => chitStampOf(e) === stamp) ) return true;
  if ( !canApplyTo(attacker) ) return false;
  // Stale chits go first — earlier turns', or a combat that ended with nobody to tidy them.
  if ( chits.length ) await attacker.deleteEmbeddedDocuments("ActiveEffect", chits.map(e => e.id));
  const clock = chipClock("cleave", turnPlace());
  if ( !clock ) return false;
  await ActiveEffect.implementation.create({
    name: "Cleave — this turn", img: ctx.weapon.img ?? "icons/svg/sword.svg",
    description: `Cleave has been offered this turn (${ctx.weapon.name}). The extra attack is once per turn; this chit ends with the turn.`,
    origin: ctx.weapon.uuid, disabled: false, transfer: false,
    ...chipData(clock),
    flags: { [MODULE_ID]: { [CHIP_FLAG]: "cleave" } }
  }, { parent: attacker });
  return false;
}

/** Topple: the demand, the native save link, and a GM affordance for the failure. */
async function toppleCard(ctx, targets, sourceMessage = null) {
  const dc = 8 + (ctx.attacker.system.attributes?.prof ?? 0)
    + (ctx.attacker.system.abilities?.[ctx.ability]?.mod ?? 0);
  const names = targets.map(t => t.name).join(", ");
  // The demand rides the SAVE timer: a demanded save is mandatory, so expiry rolls. 0 waits
  // indefinitely; the GM prone button is the paper-roll backstop.
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
      // Which damage message earned this demand — one swing asks once, however many clients
      // think they are the elect (topple.js supersedes twins).
      sourceMessageId: sourceMessage?.id ?? null,
      weapon: { name: ctx.weapon.name, img: ctx.weapon.img },
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}),
      targets: targets.map(t => ({ uuid: t.uuid, name: t.name, done: false }))
    } } }
  });
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
  // Graze's payout IS damage on the target, so with no GM there is nothing to degrade to — say so.
  const writable = targets.filter(t => {
    try { return canApplyTo(fromUuidSync(t.uuid)); } catch { return false; }
  });
  if ( !writable.length ) {
    return whisperNoGM(`Graze's ${mod} damage to ${targets.map(t => t.name).join(", ")}`,
      "Apply it by hand — the miss still pays under the rule.");
  }
  targets = writable;
  const type = [...(ctx.weapon.system.damage?.base?.types ?? [])][0] ?? "";
  await applyDamagesWithReceipt(attackMessage, targets, [{
    value: mod, type, properties: new Set(ctx.weapon.system.properties ?? [])
  }], { note: "Graze — the miss still pays" });
}

/* --- the reminder: an informational table moment ------------------------------------------ */

/** What each reminder says — the fact in the mastery's own words. The roll dialog's gate does
 * the reminding at the next roll, so the card carries no "claim it in the dialog" line. */
const NOTICE_TEXT = {
  vex: (_ctx, names) => ({
    title: "Vex — Advantage on your next attack",
    lines: [ruleLine(MASTERY_RULES.vex),
      `Against ${names}.`]
  }),
  sap: (_ctx, names) => ({
    title: `Sap — ${names} at Disadvantage`,
    lines: [ruleLine(MASTERY_RULES.sap),
      `The chip on ${names} carries the rule.`]
  }),
  cleave: (ctx, _names) => ({
    title: "Cleave — one extra attack available",
    // The sheet cannot drop the ability modifier from a roll, so the card offers the ARM: the
    // next damage roll with this weapon drops the flat modifier itself.
    lines: [ruleLine(MASTERY_RULES.cleave),
      `Press "Arm the Cleave" and the next ${ctx.weapon.name} damage roll drops the modifier for you; Dismiss to resolve it yourself — or if you've already Cleaved this turn.`]
  })
};

/**
 * The elect posts the reminder card — the durable record, and the bus the popup rides: the
 * card replicates everywhere, and the client that canAnswerFor the attacker pops the view.
 */
async function postMasteryNotice(ctx, key, targets) {
  const names = targets.map(t => t.name).join(", ");
  const { title, lines } = NOTICE_TEXT[key](ctx, names);
  const subtitle = `${ctx.attacker.name} — ${ctx.weapon.name}`;
  // 0 stamps no window; the bar and the auto-close read a missing window as "until dismissed".
  const window = Math.max(0, Number(setting(S.noticeTimer)) || 0);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: ctx.attacker }),
    content: bfCard({
      img: ctx.weapon.img, eyebrow: `Weapon Mastery — ${masteryLabel(key)}`, tone: "good",
      title, subtitle, lines
    }),
    flags: { [MODULE_ID]: { masteryNotice: {
      key, attackerUuid: ctx.attacker.uuid,
      // `id`: the Cleave arm keys on this exact weapon — a name is not an identity (two daggers).
      weapon: { id: ctx.weapon.id, name: ctx.weapon.name, img: ctx.weapon.img },
      title, subtitle, lines,
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
    } } }
  });
}

/**
 * The reminder popup: one control (OK) and an auto-dismiss on S.noticeTimer with the drain bar
 * — a reminder has nothing to decide (ARCHITECTURE.md §6). Cleave is the exception: "is my next
 * attack the Cleave?" is a decision, so it carries Arm the Cleave / Dismiss. Dismissal arms nothing.
 */
async function showMasteryNotice(message, notice) {
  const attacker = resolveUuid(notice.attackerUuid);
  // Any button acknowledges the moment (ARCHITECTURE.md §5 law 3); closing with the X is a
  // non-event and the bar drains out.
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

/* --- the Cleave arm -------------------------------------------------------------------------
 * The player DECLARES the cleave; the machine drops the flat ability-modifier part from that one
 * damage roll. Never detected silently: with Extra Attack, "second swing, same weapon, other
 * target" is an ordinary turn. The arm is an actor flag, one-shot, stale by STAMP COMPARISON —
 * in combat it carries the combat stamp and any mismatch is expiry (survives a reload); out of
 * combat it expires after 60s or on use.
 * ------------------------------------------------------------------------------------------- */

const CLEAVE_ARM_TTL_MS = 60_000;   // out-of-combat only; in combat the turn stamp governs

async function armCleave(notice) {
  const attacker = resolveUuid(notice.attackerUuid);
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

/** The arm that will bite THIS item's next damage roll, or null. Read-only; the strip below is
 * the only consumer. */
function cleaveArmedFor(item) {
  if ( item?.type !== "weapon" ) return null;
  const arm = liveCleaveArm(item.actor);
  return (arm && (arm.itemId === item.id)) ? arm : null;
}

// The armed Cleave announces itself on the damage offer before the dice: a line, nothing to commit.
registerOfferPart({
  key: "cleave",
  parts: (_attackMessage, activity) => cleaveArmedFor(activity.item)
    ? { lines: ["<strong>Cleave</strong> — this is the armed Cleave swing: the ability modifier is dropped from this roll."] }
    : null
});

// THE STRIP. Runs on whichever client rolls the damage (auto-roll, the offer's button or a
// native press), before the dice exist. The arm is consumed either way; a NEGATIVE modifier is
// kept (removing a minus would raise the damage — the system's own off-hand predicate does the
// same, AttackActivity#_processDamagePart).
Hooks.on("dnd5e.preRollDamageV2", (config, _dialog, message) => {
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
    // Message-data mutations at this hook persist onto the damage message, so the card can
    // say the modifier was dropped.
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
  m.answeredAt = Date.now();   // the crash-resume horizon
  if ( timedOut ) m.timedOut = true;
  await message.setFlag(MODULE_ID, "mastery", m);
}

/**
 * The elect claims the answer, then pays it out. ⚠ The claim-first write only stops SEQUENTIAL
 * re-fires: the render hook's resume check and the update watcher can both call this in the
 * same tick before the claim lands, and each would pay (stacked Slowed chips). The in-memory
 * latch closes that same-client race; the elect gate serializes across clients.
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
// demand's watcher lives in topple.js.
Hooks.on("updateChatMessage", message => {
  const m = message.getFlag(MODULE_ID, "mastery");
  if ( m ) {
    const dialog = livePopups.get(popupKey(message.id, "mastery"));
    if ( dialog && ((m.status !== "pending") || m.answer) ) void dialog.close();
    if ( drivesMomentFor(m?.attackerUuid) && (m.status === "pending") && m.answer ) void executeMasteryAnswer(message);
  }

  // A durably-acknowledged notice closes its popup wherever it lives.
  if ( message.getFlag(MODULE_ID, "masteryNotice")?.acknowledged ) {
    const dialog = livePopups.get(popupKey(message.id, "notice"));
    if ( dialog ) void dialog.close();
  }
});

// The shown-latches ride ui.js's one delete-sweep; only this machine's clock disarms here.
Hooks.on("deleteChatMessage", message => {
  disarmMasteryTimer(message.id);
});

/** Expiry answers Pass — the AFK fallback for a decision nobody made. */
const armMasteryTimer = message =>
  armAskTimer(masteryTimers, message, "mastery", live => answerMastery(live, "pass", { timedOut: true }));
const disarmMasteryTimer = messageId => disarmAskTimer(masteryTimers, messageId);

/** The Use/Pass popup — the same two controls for everybody, on the hold's own bar. */
async function showMasteryPopup(message, m) {
  const attacker = resolveUuid(m.attackerUuid);
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

// The card rows: the mastery ask (pending: bar + Answer; done: the outcome), the notice and
// the strip's receipt. Stateless like every render hook here.
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
    html.querySelector(SURFACES.messageContent)?.appendChild(row);
    // ⚠ The bar only drains once synced.
    if ( pending ) scheduleBarSync(row);

    if ( pending ) {
      armMasteryTimer(message);
      // Resume an ask answered while nobody could execute (the elect reloaded or came up
      // later); executeMasteryAnswer is claim-first.
      if ( m.answer && drivesMomentFor(m?.attackerUuid) ) void executeMasteryAnswer(message);
      const attacker = resolveUuid(m.attackerUuid);
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

  // The reminder popup rides the notice card: the deadline gates staleness (an old log render
  // must never nag), the shown-set gates re-pops, canAnswerFor picks the owning client.
  const notice = message.getFlag(MODULE_ID, "masteryNotice");
  if ( notice ) {
    // A notice is live while its window drains and nobody has acknowledged it.
    // ⚠ A WINDOWLESS notice (noticeTimer 0) has no deadline and is live until acknowledged —
    // testing the deadline alone would make "stays until dismissed" mean "never appears".
    const live = (!notice.deadline || (notice.deadline > Date.now()))
      && !momentAcknowledged(message, "masteryNotice");
    if ( live ) {
      const bar = document.createElement("div");
      bar.innerHTML = momentBarHTML(notice, "reminder");
      if ( bar.innerHTML.trim() ) {
        html.querySelector(SURFACES.messageContent)?.appendChild(bar);
        scheduleBarSync(bar);
      }
    }
    const attacker = resolveUuid(notice.attackerUuid);
    const shownKey = popupKey(message.id, "notice");
    if ( canAnswerFor(attacker) && live && !shownMoments.has(shownKey) ) {
      shownMoments.add(shownKey);
      void showMasteryNotice(message, notice);
    }
    // Cleave: the card states a standing arm, or recalls the decision popup while live.
    // Read-only here — display must never consume a stale arm; the strip owns that.
    if ( notice.key === "cleave" ) {
      const arm = (attacker instanceof Actor) ? attacker.getFlag(MODULE_ID, "cleaveArm") : null;
      if ( cleaveArmFresh(arm) && (arm.itemId === notice.weapon?.id) ) {
        const armed = document.createElement("div");
        armed.innerHTML = bfCard({
          img: notice.weapon?.img, eyebrow: "Weapon Mastery — Cleave", tone: "good",
          title: "Cleave — armed",
          subtitle: `The next ${arm.itemName || "weapon"} damage roll drops the ability modifier.`
        });
        html.querySelector(SURFACES.messageContent)?.appendChild(armed);
      } else if ( canAnswerFor(attacker) && live ) {
        html.querySelector(SURFACES.messageContent)?.appendChild(momentButton("Answer", () => {
          void showMasteryNotice(message, message.getFlag(MODULE_ID, "masteryNotice"));
        }, { margin: "0.25rem 0 0" }));
      }
    }
  }

  // The strip's receipt: the damage card says the modifier was dropped, from the flag the
  // strip stamped at preRollDamageV2.
  const stripped = message.getFlag(MODULE_ID, "cleaveStripped");
  if ( stripped ) {
    const line = document.createElement("div");
    line.innerHTML = bfCard({
      eyebrow: "Weapon Mastery — Cleave", tone: "neutral",
      title: "Cleave — ability modifier dropped",
      subtitle: `${stripped.itemName || "The weapon"}'s Cleave — this roll takes no ability modifier.`
    });
    html.querySelector(SURFACES.messageContent)?.appendChild(line);
  }
});
