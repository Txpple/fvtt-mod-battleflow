/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): Hew, the `hew` fold (v1.19.x, walk scope-add ②)
 * — Great Weapon Master's Bonus Action attack, a reminder card and popup, nothing driven.
 * The machine-tier pass, Stage 4a (2026-09-05): split out of maneuvers.js by MOMENT — one
 * feature per file, the shared readers in lookup.js, the rules text in decide/registry.js. Every
 * body here is the one maneuvers.js carried; nothing was rewritten.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, canAnswerFor } from "./core.js";
import { resolveUuid, foldEntryFor } from "./lookup.js";
import { maneuverFoldEntries } from "./settings.js";
import { RULE_TEXT } from "./decide/registry.js";
import { modeAllows } from "./shared.js";
import { popupKey, bfCard, momentBarHTML, ruleLine } from "./decide/present.js";
import { livePopups, openMomentPopup, scheduleBarSync, shownMoments, acknowledgeMoment,
  momentAcknowledged } from "./ui.js";

/* =============================================================================================
 * HEW (v1.19.x, walk scope-add ②) — reminder-card-only by the user's ruling: Great Weapon
 * Master's third bullet ("Immediately after you score a Critical Hit with a Melee weapon or
 * reduce a creature to 0 Hit Points with one, you can make one attack with the same weapon
 * as a Bonus Action"). Nothing rolls, nothing arms, nothing times out — the Push mastery's
 * announce idiom: the card states the option, the player swings from the sheet.
 * Two triggers, one card per swing: the CRIT posts from the roller's own client at attack
 * time; the KILL posts from the elect when a receipt shows a target at 0 HP — and defers to
 * the crit's card when both fire on one swing. A hand-tray kill posts no receipt and so no
 * reminder; module-applied damage is the only exact witness of "reduced to 0".
 * ========================================================================================== */

async function postHewReminder(attacker, featItem, weapon, why) {
  // The card is the durable record; the POPUP is the moment (walk finding (c), the user's
  // design law verbatim: "our design language is to give players popup notifications on
  // easy things to forget" — the first walk's crit card posted and was scrolled past).
  // The notice family's shape exactly: OK-only, drain bar, auto-close at the deadline.
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: bfCard({
      img: featItem.img, eyebrow: `Feat — ${featItem.name}`, tone: "good",
      title: `Hew — ${attacker.name} can attack again`,
      subtitle: why,
      // (z): the rule line is the feat's own sentence, verbatim; the swing note stays as
      // the module's hint.
      lines: [ruleLine(RULE_TEXT.hew),
        `Swing <strong>${weapon?.name ?? "the same weapon"}</strong> from the sheet; nothing is automated.`]
    }),
    flags: { [MODULE_ID]: { hewNotice: {
      attackerUuid: attacker.uuid, itemName: featItem.name, itemImg: featItem.img,
      weaponName: weapon?.name ?? null, why,
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
    } } }
  });
}

/** The Hew popup — the mastery notice's OK-only shape on the fold's own namespace. */
async function showHewPopup(message, notice) {
  const attacker = resolveUuid(notice.attackerUuid);
  await openMomentPopup(message, "hew", attacker, {
    title: `Hew — ${attacker?.name ?? ""}`, icon: "fa-solid fa-axe-battle", width: 420,
    content: bfCard({
      img: notice.itemImg, eyebrow: `Feat — ${notice.itemName}`, tone: "good",
      title: `Hew — ${attacker?.name ?? "you"} can attack again`,
      subtitle: notice.why,
      lines: [ruleLine(RULE_TEXT.hew),
        `Swing <strong>${notice.weaponName ?? "the same weapon"}</strong> from the sheet; nothing is automated.`]
    }) + momentBarHTML(notice, "reminder"),
    // The ACK (law 2, finding (j)): OK resolves the card's pending presentation everywhere.
    buttons: [{ action: "ok", label: "OK", default: true,
      callback: () => acknowledgeMoment(message, "hewNotice") }],
    autoCloseAt: notice.deadline || null
  });
}

/** The reminder pops while the moment is live — the notice family's render discipline. */
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const notice = message.getFlag(MODULE_ID, "hewNotice");
  if ( !notice ) return;
  if ( !notice.deadline || (notice.deadline <= Date.now()) ) return;
  if ( momentAcknowledged(message, "hewNotice") ) return;   // the ACK ends the presentation
  const row = document.createElement("div");
  row.innerHTML = momentBarHTML(notice, "reminder");
  html.querySelector(".message-content")?.appendChild(row);
  scheduleBarSync(row);
  const attacker = resolveUuid(notice.attackerUuid);
  const shownKey = popupKey(message.id, "hew");
  if ( canAnswerFor(attacker) && !shownMoments.has(shownKey) ) {
    shownMoments.add(shownKey);
    void showHewPopup(message, notice);
  }
});

/* --- the Hew triggers (finding (k)): BOTH live on the damage side now ------------------------
 * The old crit trigger posted from rollAttackV2 — the reminder arrived BEFORE the damage was
 * rolled, so "attack again" preceded the attack's own resolution on screen (and with the
 * damage popup open, preceded it by the whole window). Both triggers now key off the crit's
 * damage MESSAGE: damage first, then "attack again", and the dedupe is ONE flag on that
 * message — a crit that kills still reminds once (create precedes the receipt update, so the
 * crit's post wins and the kill defers). Both run on the elect; the per-message check queue
 * serializes the two triggers so neither can double-post nor eat the other's turn.
 * ------------------------------------------------------------------------------------------- */

const hewChecks = new Map();

function queueHewCheck(damageMessage, fn) {
  // The queueFlagWrite idiom (core.js): the stored link never rejects, so the chain cannot
  // break, and the map self-cleans when its tail drains.
  const prior = hewChecks.get(damageMessage.id) ?? Promise.resolve();
  const next = prior.then(fn, fn);
  const tail = next.catch(() => {});
  hewChecks.set(damageMessage.id, tail);
  void tail.then(() => { if ( hewChecks.get(damageMessage.id) === tail ) hewChecks.delete(damageMessage.id); });
  return next;
}

/** The chain behind a damage message, resolved for Hew — the die injection's measured shape:
 * the damage's originatingMessage is the USAGE card, not the attack roll. Null when this
 * damage cannot earn a Hew (no melee attack chain, no listed carrier, resolver off). */
async function hewChainContext(damageMessage) {
  const originId = damageMessage.getFlag("dnd5e", "originatingMessage");
  const origin = originId ? game.messages.get(originId) : null;
  if ( !origin ) return null;
  const attackMessage = (origin.getFlag("dnd5e", "roll.type") === "attack")
    ? origin
    : ((origin.getAssociatedRolls?.("attack") ?? []).at(-1) ?? null);
  if ( !attackMessage || (attackMessage.getFlag("dnd5e", "roll.type") !== "attack") ) return null;
  const activity = await fromUuid(attackMessage.getFlag("dnd5e", "activity")?.uuid ?? "").catch(() => null);
  if ( activity?.attack?.type?.value !== "melee" ) return null;
  const attacker = attackMessage.getAssociatedActor?.();
  if ( !attacker || !modeAllows(attacker) ) return null;
  const found = foldEntryFor(attacker, "hew", maneuverFoldEntries());
  if ( !found ) return null;
  return { attackMessage, activity, attacker, found };
}

/** The crit trigger — the elect, the moment the crit's damage roll EXISTS. */
async function maybeHewCritReminder(damageMessage) {
  try {
    if ( !isActiveGM() ) return;
    if ( damageMessage.getFlag(MODULE_ID, "hewNoticed") ) return;
    const ctx = await hewChainContext(damageMessage);
    if ( !ctx ) return;
    if ( !(ctx.attackMessage.rolls?.[0]?.isCritical ?? false) ) return;
    await damageMessage.setFlag(MODULE_ID, "hewNoticed", true);
    await postHewReminder(ctx.attacker, ctx.found.item, ctx.activity.item, "A Critical Hit with a melee weapon");
  } catch(err) {
    console.error(`${TITLE} | Hew crit reminder failed.`, err);
  }
}

Hooks.on("createChatMessage", message => {
  if ( !isActiveGM() ) return;
  if ( message.getFlag("dnd5e", "roll.type") !== "damage" ) return;
  void queueHewCheck(message, () => maybeHewCritReminder(message));
});

/** The kill trigger — the elect, off the receipt it just wrote. A hand-tray kill posts no
 * receipt and so no reminder (recorded and accepted). */
async function maybeHewKillReminder(damageMessage) {
  try {
    if ( !isActiveGM() ) return;
    if ( damageMessage.getFlag(MODULE_ID, "hewNoticed") ) return;   // the crit already said it
    const receipt = damageMessage.getFlag(MODULE_ID, "receipt");
    if ( !receipt?.targets?.length ) return;
    const ctx = await hewChainContext(damageMessage);
    if ( !ctx ) return;
    const downed = [];
    for ( const t of receipt.targets ?? [] ) {
      if ( t.reverted ) continue;
      const actor = await fromUuid(t.uuid).catch(() => null);
      if ( actor && ((actor.system?.attributes?.hp?.value ?? 1) <= 0) ) downed.push(t.name ?? actor.name);
    }
    if ( !downed.length ) return;
    await damageMessage.setFlag(MODULE_ID, "hewNoticed", true);
    await postHewReminder(ctx.attacker, ctx.found.item, ctx.activity.item, `${downed.join(", ")} down to 0 HP`);
  } catch(err) {
    console.error(`${TITLE} | Hew kill reminder failed.`, err);
  }
}

Hooks.on("updateChatMessage", message => {
  // The Hew kill trigger rides receipt writes — the elect's own update landing back. Through
  // the check queue, so it can never interleave with the crit trigger's create-side check.
  if ( message.getFlag(MODULE_ID, "receipt") && isActiveGM() ) {
    void queueHewCheck(message, () => maybeHewKillReminder(message));
  }
  // A durably-acknowledged Hew notice closes its popup wherever it lives (the ACK, law 2).
  if ( message.getFlag(MODULE_ID, "hewNotice")?.acknowledged ) {
    const dialog = livePopups.get(popupKey(message.id, "hew"));
    if ( dialog ) void dialog.close();
  }
});
