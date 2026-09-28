/**
 * Battle Flow — the cast path: the caster's flow elect lands a stamped cast's utility effects and
 * healing, with receipts, and asks the caster's EFFECT_CHOICES pick.
 */
import { MODULE_ID, TITLE, canAnswerFor, canApplyTo, drivesMomentFor, queueFlagWrite, whisperNoGM } from "./core.js";
import { cardActivity, cardItem } from "./lookup.js";
import { damagePartsOf, statSourceOf } from "./shared.js";
import { bfCard, popupKey, ruleLine } from "./decide/present.js";
import { effectsAfterChoice } from "./decide/choices.js";
import { momentButton, openMomentPopup, registerResumable, shownMoments } from "./ui.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { applyEffectsWithReceipt } from "./effect-riders.js";
import { SURFACES } from "./surfaces.js";
import { targetsOf } from "./decide/card.js";
import { listen } from "./dispatch.js";

// Auto-apply on cast (ARCHITECTURE.md §6). The STAMP is the trigger, never the setting: `castApply` and
// `healPending` are stamped at preCreate, so an old log re-rendered is inert. Left out on purpose: save
// activities (their cards are load-bearing), bare damage (Magic Missile is the negate hold's seam), and
// enchant/summon/forward.

async function executeCastApply(message) {
  try {
    const payload = message.getFlag(MODULE_ID, "castApply");
    if ( !payload?.targets?.length ) return;
    if ( message.getFlag(MODULE_ID, "effectReceipt")?.castDone ) return;
    // Through the CARD: a consumed item (a potion) lives on only in the card's snapshot.
    const activity = cardActivity(message, payload.activityUuid);
    // dnd5e 6: the list holds PROFILES; the effects resolve asynchronously.
    const applicable = (await activity?.getApplicableEffects?.()) ?? [];
    const names = effectsAfterChoice(applicable.map(e => e.name), payload.choice ?? null);
    if ( names === null ) return;   // pending — the caster's popup is open on their client
    const wanted = new Set(names.map(n => String(n).toLowerCase()));
    const effects = applicable.filter(e => wanted.has(String(e.name).toLowerCase()));
    if ( !effects.length ) return;
    // Apply what this client MAY; the driver is told the rest (core.js "THE FLOW ELECT"). The marker
    // still writes, so a rejoining GM re-pays nothing.
    const writable = payload.targets.filter(t => {
      try { return canApplyTo(fromUuidSync(t.uuid)); } catch { return false; }
    });
    const blocked = payload.targets.filter(t => !writable.includes(t));
    if ( blocked.length ) {
      await whisperNoGM(`${effects.map(e => e.name).join(", ")} on ${blocked.map(t => t.name).join(", ")}`,
        "The card stands — put the effect on by hand.");
    }
    // The caster's concentration effect, for origin linkage.
    const concentration = payload.concentration
      ? (activity?.actor?.effects.get(payload.concentration) ?? null) : null;
    await applyEffectsWithReceipt(message, effects, writable, {
      concentration, scaling: payload.scaling ?? 0,
      spellLevel: payload.spellLevel ?? undefined,
      marker: "castDone",
      source: statSourceOf(message), // the data-plane stamp — the caster's own usage card
      activity // the one resolved above — live, or the card's snapshot of a used-up item
    });
  } catch(err) {
    console.error(`${TITLE} | Cast auto-apply failed.`, err);
  }
}

// ⚠ A CLAIM ON THE HEALING: it waits on the Healer's rerolls (heal-rerolls.js) so it lands ONCE, as
// auto-apply.js EITHER_WAITS does for damage.
const HEAL_REROLL_WAITS = new Set(["due", "pending", "answering"]);
const healRerollWaits = message => HEAL_REROLL_WAITS.has(message.getFlag(MODULE_ID, "healReroll")?.status);

async function applyCastHealing(message) {
  try {
    if ( message.getFlag(MODULE_ID, "receipt") ) return; // applied (or reverted) already
    if ( healRerollWaits(message) ) return;               // the Healer's answer first (the claim above)
    // A SELF-aimed heal carries its target on the stamp; the dnd5e snapshot is incidental there.
    const stamp = message.getFlag(MODULE_ID, "healPending");
    const targets = stamp?.selfAim
      ? [{ uuid: stamp.uuid, name: stamp.name }]
      : targetsOf(message).map(t => ({ uuid: t.uuid, name: t.name }));
    if ( !targets.length ) return;
    const damages = damagePartsOf(message.rolls);
    if ( !damages.length ) return;
    await applyDamagesWithReceipt(message, targets, damages, { note: "Healing" });
  } catch(err) {
    console.error(`${TITLE} | Healing auto-apply failed.`, err);
  }
}

// The CASTER's flow elect drives these (ARCHITECTURE §3, the driver table); the answered choice is the
// one update that resumes a cast.
const castSubject = message => message?.getAssociatedActor?.()?.uuid ?? null;
registerResumable("castApply", {
  pending: (flag, _message, cause) => (cause !== "update") || !!flag.choice?.chosen,
  drives: (_flag, message) => drivesMomentFor(castSubject(message)),
  drive: executeCastApply
});
registerResumable("healPending", {
  // An update resumes it only as the Healer's claim settles (heal-rerolls.js writes its status here).
  pending: (_flag, message, cause) => (cause !== "update")
    || (!!message.getFlag(MODULE_ID, "healReroll") && !healRerollWaits(message) && !message.getFlag(MODULE_ID, "receipt")),
  drives: (_flag, message) => drivesMomentFor(castSubject(message)),
  drive: applyCastHealing
});

// THE CHOICE (EFFECT_CHOICES): the popup opens on the caster's client and the answer folds onto the
// caster's own card; no clock — the card's button reopens it.

async function chooseEffect(card, name) {
  const choice = card.getFlag(MODULE_ID, "castApply")?.choice;
  if ( !choice || choice.chosen || !choice.options?.includes(name) ) return;
  await queueFlagWrite(card, "castApply", current => {
    if ( !current.choice || current.choice.chosen ) return false;
    current.choice.chosen = name;
    current.choice.answeredAt = Date.now();
  });
}

async function showChoicePopup(card) {
  const payload = card.getFlag(MODULE_ID, "castApply");
  const choice = payload?.choice;
  if ( !choice || choice.chosen ) return;
  const actor = payload.targets?.[0]?.uuid ? fromUuidSync(payload.targets[0].uuid) : null;
  const item = cardItem(card);
  await openMomentPopup(card, "effectChoice", actor, {
    title: `${choice.key} — ${actor?.name ?? ""}`, icon: "fa-solid fa-code-branch",
    content: bfCard({ img: item?.img ?? null, eyebrow: `Cast — ${choice.key}`, tone: "pending",
      title: choice.ask ?? "Which effect?", lines: [ruleLine(choice.rule)] }),
    buttons: choice.options.map((name, i) => ({ action: `pick-${i}`, label: name, default: i === 0, callback: () => chooseEffect(card, name) }))
  });
}

listen("dnd5e.renderChatMessage", "cast", (message, html) => {
  const payload = message.getFlag(MODULE_ID, "castApply");
  const choice = payload?.choice;
  if ( !choice ) return;
  const line = document.createElement("div");
  line.innerHTML = bfCard({ eyebrow: `Cast — ${choice.key}`, tone: choice.chosen ? "good" : "pending",
    title: choice.chosen ? `${choice.chosen} — the caster's choice` : (choice.ask ?? "Which effect?"),
    subtitle: choice.chosen ? "" : `the cast waits for the pick — ${choice.options.join(" or ")}`,
    lines: [ruleLine(choice.rule)] });
  html.querySelector(SURFACES.messageContent)?.appendChild(line);
  if ( choice.chosen ) return;
  const actor = payload.targets?.[0]?.uuid ? fromUuidSync(payload.targets[0].uuid) : null;
  if ( !canAnswerFor(actor) ) return;
  const shownKey = popupKey(message.id, "effectChoice");
  if ( !shownMoments.has(shownKey) ) { shownMoments.add(shownKey); void showChoicePopup(message); }
  line.appendChild(momentButton(`Choose — ${choice.key}`, () => void showChoicePopup(message)));
});

