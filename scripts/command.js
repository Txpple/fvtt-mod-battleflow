/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): Commander's Strike, the `command` fold
 * (2026-09-05, "the rest of maneuvers") — the fighter's die on an ally's Reaction attack.
 * The machine-tier pass, Stage 4a (2026-09-05): split out of maneuvers.js by MOMENT — one
 * feature per file, the shared readers in lookup.js, the rules text in decide/registry.js. Every
 * body here is the one maneuvers.js carried; nothing was rewritten.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, queueFlagWrite, canAnswerFor, statContext } from "./core.js";
import { resolveDie, foldEntryFor, maneuverDieFormula } from "./lookup.js";
import { maneuverFoldEntries } from "./settings.js";
import { RULE_TEXT } from "./decide/registry.js";
import { chipData, placeOf, poolSpendsOn, spendReaction } from "./shared.js";
import { popupKey, bfCard, momentBarHTML, ruleLine, spendPhrase } from "./decide/present.js";
import { CHIP_FLAG, chipClock } from "./decide/chips.js";
import { openMomentPopup, momentButton, shownMoments, acknowledgeMoment, momentAcknowledged } from "./ui.js";

/* =============================================================================================
 * COMMANDER'S STRIKE (2026-09-05, "the rest of maneuvers") — the `command` fold kind: Riposte's
 * driven attack with the ATTACKER changed. The fighter uses "Directed Attack" (a damage activity
 * whose target is the willing ALLY; `use()` spends the Superiority Die), and the ally may use its
 * Reaction to make one attack with a weapon, the fighter's die on the damage if it hits. The 2024
 * pack ships the activity as damage typed by choice ("select the type in the roll dialog") — the
 * die rides the ALLY's weapon in the weapon's type, exactly as a riposte's die does.
 *
 *   THE STAMP — the fighter's client, on the usage card: the ally, the fighter's die (resolved on
 *   the FIGHTER's sheet — it is their scale value), the hold family's clock. The native follow-up
 *   (a damage dialog for a die that belongs to the ally's hit) is switched off at the use.
 *   THE ASK — the ally's owner gets the riposte popup's shape: a weapon dropdown (every attack
 *   activity, melee first) and Attack / Decline. The ally must have a target on the canvas — the
 *   module never picks whom the ally strikes (R1).
 *   THE ANSWER — a fold on the fighter's card: the owner writes straight, a player's click travels
 *   as an envelope the elect folds (the riposte relay's shape). The answering client drives the
 *   attack itself: the ally's Reaction spent, the weapon used, the attack rolled with the fighter's
 *   card as its provenance (`riposteFor`/`riposteBy` — the riposte die's injection, idempotence
 *   and the resolver's "driven attacks never chain re-offers" all read those two flags).
 *   THE CLOCK — the timer declines; the die is already spent (the use spent it).
 * ========================================================================================== */

Hooks.on("dnd5e.preUseActivity", (activity, usageConfig) => {
  try {
    if ( (activity?.type !== "damage") || !activity.actor ) return;
    if ( !foldEntryFor(activity.actor, "command", maneuverFoldEntries()) ) return;
    const found = foldEntryFor(activity.actor, "command", maneuverFoldEntries());
    if ( found.item.id !== activity.item?.id ) return;
    usageConfig.subsequentActions = false;   // the die is the ally's hit's, not the Bonus Action's
  } catch(err) { console.warn(`${TITLE} | Could not claim Commander's Strike's use.`, err); }
});

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  try {
    if ( (activity?.type !== "damage") || !activity.actor?.isOwner ) return;
    const found = foldEntryFor(activity.actor, "command", maneuverFoldEntries());
    if ( !found || (found.item.id !== activity.item?.id) ) return;
    const message = (results?.message instanceof ChatMessage) ? results.message : null;
    if ( !message || message.getFlag(MODULE_ID, "command") ) return;
    void stampCommand(activity, activity.actor, message, found);
  } catch(err) {
    console.error(`${TITLE} | Commander's Strike failed at the use — direct the strike by hand.`, err);
  }
});

/** The fighter's client, at the use: the ally, the die (the FIGHTER's scale value), the notice's clock. */
async function stampCommand(activity, fighter, message, found) {
  const targets = (message.getFlag("dnd5e", "targets") ?? []).filter(t => t.uuid !== fighter.uuid);
  const ally = targets[0] ?? null;
  // The die is the FIGHTER's scale value — resolved here, on the fighter, because it rides the
  // ALLY's roll (measured: the raw `@scale.battle-master.superiority.die` read 0 on the Ranger).
  const dieFormula = resolveDie(fighter, maneuverDieFormula(activity));
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  await message.setFlag(MODULE_ID, "command", {
    status: ally ? "directed" : "no ally", ...statContext(fighter.uuid),
    attackerUuid: fighter.uuid, attackerName: fighter.name, itemName: found.item.name, itemImg: found.item.img ?? null,
    itemUuid: found.item.uuid, ally: ally ? { uuid: ally.uuid, name: ally.name } : null, dieFormula, chipId: null,
    ...((window && ally) ? { window, deadline: Date.now() + (window * 1000) } : {})
  });
}

/**
 * THE CHIP — written by the ELECT from the card (the fighter's client may not own the ally's
 * sheet; every world write of a consequence is the elect's), once: the fighter's die on the
 * ally's sheet until the end of the fighter's turn, spent by the ally's next attack's damage.
 */
async function ensureCommandChip(message) {
  const flag = message.getFlag(MODULE_ID, "command");
  if ( !flag || (flag.status !== "directed") || flag.chipId || !flag.ally?.uuid ) return;
  const ally = await fromUuid(flag.ally.uuid).catch(() => null);
  if ( !(ally instanceof Actor) ) return;
  const standing = ally.effects.find(e => (e.getFlag(MODULE_ID, CHIP_FLAG) === "use") && (e.getFlag(MODULE_ID, "useKey") === "command") && (e.getFlag(MODULE_ID, "cardId") === message.id));
  let chip = standing ?? null;
  if ( !chip ) {
    const stale = ally.effects.filter(e => (e.getFlag(MODULE_ID, CHIP_FLAG) === "use") && (e.getFlag(MODULE_ID, "useKey") === "command"));
    if ( stale.length ) await ally.deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id)).catch(() => {});
    const fighter = flag.attackerUuid ? await fromUuid(flag.attackerUuid).catch(() => null) : null;
    const clock = chipClock("steadyAim", placeOf(fighter ?? ally));
    chip = await ActiveEffect.implementation.create({
      name: flag.itemName, img: flag.itemImg ?? "icons/svg/aura.svg",
      description: `<p><em>“${RULE_TEXT.command}”</em></p><p>Written by Battle Flow when ${flag.attackerName} used ${flag.itemName}: ${ally.name} may use a Reaction to make one attack with a weapon or an Unarmed Strike; ${flag.dieFormula ?? "the Superiority Die"} rides the damage of the next hit.</p>`,
      origin: flag.itemUuid ?? null, disabled: false, transfer: false,
      ...(clock ? chipData(clock) : {}),
      flags: { [MODULE_ID]: { [CHIP_FLAG]: "use", useKey: "command", die: flag.dieFormula ?? null, sourceUuid: flag.attackerUuid, sourceName: flag.attackerName, cardId: message.id } }
    }, { parent: ally }).catch(err => { console.error(`${TITLE} | Commander's Strike could not mark the ally — add the die by hand.`, err); return null; });
  }
  if ( chip ) await queueFlagWrite(message, "command", current => { if ( current.chipId ) return false; current.chipId = chip.id; });
}

Hooks.on("createChatMessage", message => { if ( isActiveGM() && message.getFlag(MODULE_ID, "command") ) void ensureCommandChip(message); });

/**
 * THE NOTICE — the ally's owner is told, and that is all (user, 2026-09-05: "a popup on the PC
 * recipient, informing them that they can make an attack as a reaction"; "get rid of the weird
 * trying to control that other pc workflow"). The Hew notice's shape: OK-only, the drain bar,
 * auto-close at the deadline; the ally attacks from their own sheet and the chip does the rest.
 */
async function showCommandNotice(message) {
  const flag = message.getFlag(MODULE_ID, "command");
  if ( !flag || (flag.status !== "directed") ) return;
  const ally = flag.ally?.uuid ? fromUuidSync(flag.ally.uuid) : null;
  await openMomentPopup(message, "command", ally, {
    title: `${flag.itemName} — ${flag.ally?.name ?? ""}`, icon: "fa-solid fa-bullhorn", width: 440,
    content: bfCard({ img: flag.itemImg, eyebrow: `Maneuver — ${flag.itemName}`, tone: "pending",
      title: `${flag.attackerName} directs you to strike`,
      subtitle: `Use your Reaction to make one attack with a weapon or an Unarmed Strike from your sheet — ${flag.attackerName}'s ${flag.dieFormula ?? "Superiority Die"} rides the damage if it hits`,
      lines: [ruleLine(RULE_TEXT.command)] }) + (flag.deadline ? momentBarHTML(flag, "reminder") : ""),
    buttons: [{ action: "ok", label: "OK", default: true, callback: () => acknowledgeMoment(message, "command") }],
    autoCloseAt: flag.deadline || null
  });
}

/**
 * THE RIDE — the ally's next attack's damage: the chip on the ATTACKER carries the fighter's
 * die, which folds INTO the base roll (the riposte die's idiom — one dice group, one total,
 * crit-doubled with it); the chip is spent, the ally's Reaction with it, and the damage message
 * says so. The fighter's card learns of it from the elect (below).
 */
Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
  try {
    const activity = config.subject;
    if ( activity?.type !== "attack" ) return;
    const actor = activity.item?.actor;
    if ( !actor ) return;
    const chip = actor.effects.find(e => (e.getFlag(MODULE_ID, CHIP_FLAG) === "use") && (e.getFlag(MODULE_ID, "useKey") === "command"));
    if ( !chip ) return;
    const formula = chip.getFlag(MODULE_ID, "die");
    const type = [...(activity.item?.system?.damage?.base?.types ?? [])][0] ?? "";
    if ( formula ) {
      const base = (config.rolls ?? []).find(r => r.base === true);
      if ( base ) base.parts = [...(base.parts ?? []), formula];
      else config.rolls.push({ data: config.rolls[0]?.data ?? {}, parts: [formula], options: { type, types: type ? [type] : [] } });
    }
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.commandRide`, {
      ...statContext(actor.uuid), cardId: chip.getFlag(MODULE_ID, "cardId") ?? null, formula: formula ?? null, type,
      by: actor.name, directedBy: chip.getFlag(MODULE_ID, "sourceName") ?? null, weapon: activity.item?.name ?? null
    });
    void chip.delete().catch(() => {});
    void spendReaction(actor, { origin: chip.origin ?? null, what: "Commander's Strike" });
  } catch(err) {
    console.error(`${TITLE} | Commander's Strike's die failed to ride — add it by hand.`, err);
  }
});

// The fighter's card records the strike — the elect folds it from the ally's damage message.
Hooks.on("createChatMessage", message => {
  const ride = message.getFlag(MODULE_ID, "commandRide");
  if ( !ride?.cardId || !isActiveGM() ) return;
  const card = game.messages.get(ride.cardId);
  if ( !card ) return;
  void queueFlagWrite(card, "command", current => {
    if ( current.status !== "directed" ) return false;
    current.status = "struck"; current.struck = { by: ride.by, weapon: ride.weapon ?? null, at: Date.now() };
  }).catch(err => console.warn(`${TITLE} | Could not record the directed strike on the card.`, err));
});

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const ride = message.getFlag(MODULE_ID, "commandRide");
  if ( ride ) {
    const line = document.createElement("div");
    line.innerHTML = bfCard({ eyebrow: "Maneuver — Commander's Strike", tone: "good",
      title: `Commander's Strike — ${ride.formula ?? "the die"}${ride.type ? ` ${ride.type}` : ""} rode this roll`,
      subtitle: `${ride.by}'s Reaction${ride.directedBy ? `, directed by ${ride.directedBy}` : ""}`,
      lines: [ruleLine(RULE_TEXT.command)] });
    html.querySelector(".message-content")?.appendChild(line);
  }
  const flag = message.getFlag(MODULE_ID, "command");
  if ( !flag ) return;
  const directed = flag.status === "directed";
  const live = directed && (!flag.deadline || (flag.deadline > Date.now())) && !momentAcknowledged(message, "command");
  const line = document.createElement("div");
  line.innerHTML = bfCard({
    img: flag.itemImg, eyebrow: `Maneuver — ${flag.itemName}`, tone: (flag.status === "struck") ? "good" : directed ? "pending" : "neutral",
    title: (flag.status === "no ally") ? `${flag.itemName} — no ally targeted; direct the strike by hand`
      : (flag.status === "struck") ? `${flag.itemName} — ${flag.struck?.by ?? flag.ally?.name} struck${flag.struck?.weapon ? ` with ${flag.struck.weapon}` : ""}; ${flag.dieFormula ?? "the die"} rode the hit`
      : `${flag.itemName} — ${flag.ally?.name} may use a Reaction to make one attack; ${flag.dieFormula ?? "the die"} rides the hit`,
    subtitle: spendPhrase(poolSpendsOn(message)),
    lines: [ruleLine(RULE_TEXT.command)]
  }) + (live ? momentBarHTML(flag, "reminder") : "");
  html.querySelector(".message-content")?.appendChild(line);
  if ( isActiveGM() ) void ensureCommandChip(message);   // the resume floor
  const ally = flag.ally?.uuid ? fromUuidSync(flag.ally.uuid) : null;
  if ( live && canAnswerFor(ally) ) {
    const shownKey = popupKey(message.id, "command");
    if ( !shownMoments.has(shownKey) ) { shownMoments.add(shownKey); void showCommandNotice(message); }
    line.appendChild(momentButton(`Show — ${flag.itemName}`, () => void showCommandNotice(message)));
  }
});
