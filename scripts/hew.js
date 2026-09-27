/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the `hew` fold — a bonus swing's reminder card and
 * popup (Great Weapon Master's Hew; Polearm Master's Pole Strike, which is also offered and driven).
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, canAnswerFor, combatStamp } from "./core.js";
import { cardActivity, resolveUuid, foldEntryFor, lower } from "./lookup.js";
import { attackMessageForDamage } from "./auto-damage.js";
import { tokenForUuid } from "./geometry.js";
import { maneuverFoldEntries } from "./settings.js";
import { BONUS_SWINGS, RULE_TEXT } from "./decide/registry.js";
import { hitTargets, modeAllows, withTargets } from "./shared.js";
import { popupKey, bfCard, momentBarHTML, ruleLine } from "./decide/present.js";
import { SURFACES } from "./surfaces.js";
import { CARD, activityUuidOf, isCard, originIdOf, originData, targetsOf } from "./decide/card.js";
import { livePopups, openMomentPopup, scheduleBarSync, shownMoments, acknowledgeMoment,
  momentAcknowledged } from "./ui.js";

// HEW — a reminder only; the player swings from the sheet. A crit that kills reminds once. ⚠ A
// hand-tray kill posts no receipt, so no reminder: module damage is the only witness of "to 0".

/** The bonus-swing row a listed `hew` feat stands for; without one, Hew's shape (crit or kill). */
const swingRowOf = name => {
  const key = Object.keys(BONUS_SWINGS).find(k => lower(k) === lower(name));
  return key ? BONUS_SWINGS[key] : null;
};
const whenOf = name => swingRowOf(name)?.when ?? "critOrKill";

async function postHewReminder(attacker, featItem, weapon, why, row = null, offer = null) {
  const label = row?.label ?? "Hew";
  // The card is the record; the popup the moment (OK-only, drain bar, auto-close).
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: bfCard({
      img: featItem.img, eyebrow: `Feat — ${featItem.name}`, tone: "good",
      title: `${label} — ${attacker.name} can attack again`,
      subtitle: why,
      lines: [ruleLine(row?.rule ?? RULE_TEXT.hew),
        row?.swing ?? `Swing <strong>${weapon?.name ?? "the same weapon"}</strong> from the sheet; nothing is automated.`]
    }),
    flags: { [MODULE_ID]: { hewNotice: {
      attackerUuid: attacker.uuid, itemName: featItem.name, itemImg: featItem.img,
      weaponName: weapon?.name ?? null, why,
      ...(row ? { label, rule: row.rule, swing: row.swing ?? null } : {}),
      ...(row?.when === "attack" ? { stamp: combatStamp() } : {}),
      ...(offer ? { offer } : {}),
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
    } } }
  });
}

async function showHewPopup(message, notice) {
  const attacker = resolveUuid(notice.attackerUuid);
  await openMomentPopup(message, "hew", attacker, {
    title: `${notice.label ?? "Hew"} — ${attacker?.name ?? ""}`, icon: "fa-solid fa-axe-battle", width: 420,
    content: bfCard({
      img: notice.itemImg, eyebrow: `Feat — ${notice.itemName}`, tone: "good",
      title: `${notice.label ?? "Hew"} — ${attacker?.name ?? "you"} can attack again`,
      subtitle: notice.why,
      lines: [ruleLine(notice.rule ?? RULE_TEXT.hew),
        notice.swing ?? `Swing <strong>${notice.weaponName ?? "the same weapon"}</strong> from the sheet; nothing is automated.`]
    }) + momentBarHTML(notice, "reminder"),
    // An OFFER (Pole Strike) asks Use / Pass (Use drives the swing here); either acknowledges.
    buttons: notice.offer ? [
      { action: "use", label: notice.label ?? "Swing", default: true,
        callback: () => { void answerSwingOffer(message, true); } },
      { action: "pass", label: "Pass", callback: () => { void answerSwingOffer(message, false); } }
    ] : [{ action: "ok", label: "OK", default: true,
      callback: () => acknowledgeMoment(message, "hewNotice") }],
    autoCloseAt: notice.deadline || null
  });
}

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const notice = message.getFlag(MODULE_ID, "hewNotice");
  if ( !notice ) return;
  if ( !notice.deadline || (notice.deadline <= Date.now()) ) return;
  if ( momentAcknowledged(message, "hewNotice") ) return;   // the ACK ends the presentation
  const row = document.createElement("div");
  row.innerHTML = momentBarHTML(notice, "reminder");
  html.querySelector(SURFACES.messageContent)?.appendChild(row);
  scheduleBarSync(row);
  const attacker = resolveUuid(notice.attackerUuid);
  const shownKey = popupKey(message.id, "hew");
  if ( canAnswerFor(attacker) && !shownMoments.has(shownKey) ) {
    shownMoments.add(shownKey);
    void showHewPopup(message, notice);
  }
});

// The Hew triggers key off the damage MESSAGE (one dedupe flag on it), on the elect, serialized
// per message so neither double-posts.

const hewChecks = new Map();

function queueHewCheck(damageMessage, fn) {
  // The queueFlagWrite idiom.
  const prior = hewChecks.get(damageMessage.id) ?? Promise.resolve();
  const next = prior.then(fn, fn);
  const tail = next.catch(() => {});
  hewChecks.set(damageMessage.id, tail);
  void tail.then(() => { if ( hewChecks.get(damageMessage.id) === tail ) hewChecks.delete(damageMessage.id); });
  return next;
}

/** The chain behind a damage message (⚠ originatingMessage is the USAGE card); null when no Hew. */
async function hewChainContext(damageMessage) {
  const originId = originIdOf(damageMessage);
  const origin = originId ? game.messages.get(originId) : null;
  if ( !origin ) return null;
  const attackMessage = isCard(origin, CARD.attack)
    ? origin
    : ((origin.getAssociatedRolls?.("attack") ?? []).at(-1) ?? null);
  if ( !attackMessage || !isCard(attackMessage, CARD.attack) ) return null;
  const activity = cardActivity(attackMessage, activityUuidOf(attackMessage));
  if ( activity?.attack?.type?.value !== "melee" ) return null;
  const attacker = attackMessage.getAssociatedActor?.();
  if ( !attacker || !modeAllows(attacker) ) return null;
  const found = foldEntryFor(attacker, "hew", maneuverFoldEntries().filter(e => whenOf(e.name) === "critOrKill"));
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
  if ( !isCard(message, CARD.damage) ) return;
  void queueHewCheck(message, () => maybeHewCritReminder(message));
});

/** The kill trigger — the elect, off the receipt it just wrote. */
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
  // The kill trigger rides receipt writes, through the check queue.
  if ( message.getFlag(MODULE_ID, "receipt") && isActiveGM() ) {
    void queueHewCheck(message, () => maybeHewKillReminder(message));
  }
  // A durably-acknowledged notice closes its popup wherever it lives.
  if ( message.getFlag(MODULE_ID, "hewNotice")?.acknowledged ) {
    const dialog = livePopups.get(popupKey(message.id, "hew"));
    if ( dialog ) void dialog.close();
  }
});

// The ATTACK trigger (`when: "attack"`, Pole Strike): once the attack resolves (a hit's damage card,
// or a total miss); once per the owner's own turn in combat, every attack out of it.

/** A named base item, or every named property. */
function swingWeaponFits(row, item) {
  if ( item?.type !== "weapon" ) return false;
  const base = item.system?.type?.baseItem ?? null;
  if ( base && (row.weapons?.base ?? []).includes(base) ) return true;
  const props = row.weapons?.properties ?? [];
  return !!props.length && props.every(pr => item.system?.properties?.has?.(pr));
}

/** The listed attack-row feat this attack earns a reminder for, with its item — or null. */
function attackSwingFor(attackMessage) {
  const activity = cardActivity(attackMessage, activityUuidOf(attackMessage));
  if ( activity?.attack?.type?.value !== "melee" ) return null;
  const attacker = attackMessage.getAssociatedActor?.();
  if ( !attacker || !modeAllows(attacker) ) return null;
  for ( const entry of maneuverFoldEntries().filter(e => (e.kind === "hew") && (whenOf(e.name) === "attack")) ) {
    const row = swingRowOf(entry.name);
    if ( !swingWeaponFits(row, activity.item) ) continue;
    const found = foldEntryFor(attacker, "hew", [entry]);
    if ( found ) return { attacker, activity, row, item: found.item };
  }
  return null;
}

/** On the owner's own turn (a running combat), and not yet reminded this turn. */
function swingTurnOpen(attacker, row) {
  const combat = game.combat;
  if ( !combat?.started || !combat.getCombatantsByActor(attacker).length ) return true;
  if ( combat.combatant?.actor?.uuid !== attacker.uuid ) return false;          // an Opportunity Attack: not the Attack action
  const stamp = combatStamp();
  return !game.messages.contents.slice(-60).some(m => {
    const n = m.getFlag(MODULE_ID, "hewNotice");
    return n && (n.attackerUuid === attacker.uuid) && (n.label === row.label) && (n.stamp === stamp);
  });
}

const swingPosted = new Set();
async function maybeSwingReminder(attackMessage) {
  try {
    if ( !isActiveGM() || swingPosted.has(attackMessage.id) ) return;
    if ( attackMessage.getFlag(MODULE_ID, "swingNoticed") ) return;
    if ( attackMessage.getFlag(MODULE_ID, "poleStrike") ) return;   // the swing itself never offers another
    const ctx = attackSwingFor(attackMessage);
    if ( !ctx || !swingTurnOpen(ctx.attacker, ctx.row) ) return;
    swingPosted.add(attackMessage.id);
    await attackMessage.setFlag(MODULE_ID, "swingNoticed", true);
    // A row with `drive` OFFERS the swing: the weapon, at the creature the attack was aimed at.
    const target = ctx.row.drive ? (targetsOf(attackMessage)[0] ?? null) : null;
    const offer = (ctx.row.drive && target) ? { weaponId: ctx.activity.item.id, activityId: ctx.activity.id,
      targetUuid: target.uuid, targetName: target.name, attackId: attackMessage.id } : null;
    await postHewReminder(ctx.attacker, ctx.item, ctx.activity.item, `An attack with ${ctx.activity.item?.name ?? "the weapon"}`, ctx.row, offer);
  } catch(err) {
    console.error(`${TITLE} | The bonus swing reminder failed.`, err);
  }
}

Hooks.on("createChatMessage", message => {
  if ( !isActiveGM() ) return;
  if ( isCard(message, CARD.attack) ) {
    if ( !hitTargets(message).length ) void maybeSwingReminder(message);
    return;
  }
  if ( isCard(message, CARD.damage) ) {
    const originId = originIdOf(message);
    const origin = originId ? game.messages.get(originId) : null;
    const attack = !origin ? null : isCard(origin, CARD.attack) ? origin
      : ((origin.getAssociatedRolls?.("attack") ?? []).at(-1) ?? null);
    if ( attack && isCard(attack, CARD.attack) ) void maybeSwingReminder(attack);
  }
});

// THE DRIVEN SWING (Pole Strike): the WEAPON's own attack (so its bonuses, masteries and styles ride),
// marked `poleStrike`; its die becomes a Bludgeoning d4 below.

const swinging = new Set();
async function answerSwingOffer(message, use) {
  const notice = message.getFlag(MODULE_ID, "hewNotice");
  if ( !notice?.offer || momentAcknowledged(message, "hewNotice") || swinging.has(message.id) ) return;
  swinging.add(message.id);
  try {
    await acknowledgeMoment(message, "hewNotice");
    if ( !use ) return;
    const attacker = resolveUuid(notice.attackerUuid);
    const weapon = attacker?.items?.get(notice.offer.weaponId);
    const activity = weapon?.system?.activities?.get(notice.offer.activityId);
    const token = tokenForUuid(notice.offer.targetUuid);
    if ( !activity || !token ) { ui.notifications?.warn(`${TITLE}: ${notice.label} — the weapon or the target is gone; swing from the sheet.`); return; }
    await withTargets([token], async () => {
      const done = await activity.use({ subsequentActions: false }, { configure: false }, { data: { flags: { [MODULE_ID]: { poleStrike: message.id } } } });
      const usageId = done?.message?.id ?? null;
      await activity.rollAttack({}, { configure: false },
        { data: { ...(usageId ? originData(usageId) : {}), flags: { [MODULE_ID]: { poleStrike: message.id } } } });
    });
  } catch(err) {
    console.error(`${TITLE} | The ${notice?.label ?? "bonus"} swing could not be driven — swing from the sheet.`, err);
  } finally {
    swinging.delete(message.id);
  }
}

const DIE = /(\d*)d(\d+)/i;
Hooks.on("dnd5e.preRollDamageV2", (config, _dialog, message) => {
  try {
    const activity = config?.subject;
    if ( activity?.type !== "attack" ) return;
    const attackMessage = attackMessageForDamage(config, message);
    if ( !attackMessage?.getFlag(MODULE_ID, "poleStrike") ) return;
    const roll = config.rolls?.[0];
    const parts = Array.isArray(roll?.parts) ? roll.parts : null;
    const i = parts ? parts.findIndex(p => DIE.test(String(p))) : -1;
    if ( i < 0 ) return;
    const was = String(parts[i]);
    parts[i] = was.replace(DIE, (_m, n) => `${n || 1}d4`);
    roll.options ??= {};
    roll.options.type = "bludgeoning";
    roll.options.types = ["bludgeoning"];
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.poleStrikeDie`, { was, now: parts[i] });
  } catch(err) {
    console.error(`${TITLE} | Pole Strike's d4 could not be swapped in — the damage is the weapon's own.`, err);
  }
});

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const f = message.getFlag(MODULE_ID, "poleStrikeDie");
  if ( !f ) return;
  const content = html.querySelector?.(SURFACES.messageContent) ?? html;
  if ( !content || content.querySelector(".bf-pole-strike-line") ) return;
  const div = document.createElement("div");
  div.className = "bf-pole-strike-line";
  div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
  div.textContent = `Pole Strike — the other end: ${f.now} Bludgeoning in place of ${f.was}`;
  content.appendChild(div);
});

// The usage card's item snapshot is renamed "<weapon> — Pole Strike" as the card is born (DATA).
Hooks.on("dnd5e.preCreateUsageMessage", (_activity, messageConfig) => {
  try {
    const data = messageConfig?.data;
    if ( !foundry.utils.getProperty(data ?? {}, `flags.${MODULE_ID}.poleStrike`) ) return;
    const item = data.system?.item;
    if ( item?.name && !/— Pole Strike$/.test(item.name) ) item.name = `${item.name} — Pole Strike`;
    if ( data.title ) data.title = `${data.title} — Pole Strike`;
  } catch(err) {
    console.warn(`${TITLE} | The Pole Strike card could not be titled.`, err);
  }
});

// …and its attack and damage cards: their header reads the LIVE item, so the label is drawn at render.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    if ( !message.getFlag(MODULE_ID, "poleStrike") && !message.getFlag(MODULE_ID, "poleStrikeDie") ) return;
    const title = html.querySelector?.(SURFACES.cardHeaderTitle);
    if ( title && !/— Pole Strike$/.test(title.textContent ?? "") ) title.textContent = `${title.textContent} — Pole Strike`;
  } catch(err) {
    console.warn(`${TITLE} | The Pole Strike card could not be titled.`, err);
  }
});
