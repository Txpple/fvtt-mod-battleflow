/**
 * Battle Flow — the cast path: the caster's flow elect executes a stamped cast payload - utility effects and healing, receipts throughout.
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
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

/* ---------------------------------------------------------------------------------------------
 * Auto-apply on cast (ARCHITECTURE.md §6). A used activity with no outcome gate resolves at cast,
 * on the elect: a utility activity's effects land on every snapshot target, and a heal activity's
 * self-rolled healing lands through the shared applier (calculateDamage negates healing-typed
 * entries natively; "maximum"/"temphp" ride the treatAs plumbing off the roll message passed as
 * originatingMessage). Receipts and revert everywhere.
 * The STAMP is the trigger, never the setting: the initiating client stamps `castApply` on a
 * qualifying usage card and `healPending` on a targeted healing roll at preCreate, and the elect
 * reacts on arrival and on render (reload resume) — an unstamped message can never be applied, so
 * rendering an old log is inert by construction.
 * Deliberately OUT: save activities (their cards are load-bearing), bare damage activities (Magic
 * Missile is the negate hold's seam — auto-apply would beat a pending hold's verdict), and
 * enchant/summon/forward (not effects-on-target casts).
 * ------------------------------------------------------------------------------------------- */

async function executeCastApply(message) {
  try {
    const payload = message.getFlag(MODULE_ID, "castApply");
    if ( !payload?.targets?.length ) return;
    if ( message.getFlag(MODULE_ID, "effectReceipt")?.castDone ) return;
    // Through the CARD (lookup.js): an item the use consumed (a potion) is gone by now, and the
    // card's snapshot is where its effect still lives.
    const activity = cardActivity(message, payload.activityUuid);
    // dnd5e 6: the activity's list holds PROFILES; the effects resolve asynchronously (lookup.js).
    const applicable = (await activity?.getApplicableEffects?.()) ?? [];
    // A cast with a CHOICE between alternative effects waits on the card until the caster answers;
    // then only the pick lands.
    const names = effectsAfterChoice(applicable.map(e => e.name), payload.choice ?? null);
    if ( names === null ) return;   // pending — the caster's popup is open on their client
    const wanted = new Set(names.map(n => String(n).toLowerCase()));
    const effects = applicable.filter(e => wanted.has(String(e.name).toLowerCase()));
    if ( !effects.length ) return;
    // This client applies what it MAY — the caster's own sheet always, another PC's when it owns
    // it, a monster's only as the GM — and the driver is TOLD what did not land (core.js "THE FLOW
    // ELECT"). The marker still writes, so the card is asked once: a GM rejoining re-pays nothing,
    // and the whisper is the record of what to put on by hand.
    const writable = payload.targets.filter(t => {
      try { return canApplyTo(fromUuidSync(t.uuid)); } catch { return false; }
    });
    const blocked = payload.targets.filter(t => !writable.includes(t));
    if ( blocked.length ) {
      await whisperNoGM(`${effects.map(e => e.name).join(", ")} on ${blocked.map(t => t.name).join(", ")}`,
        "The card stands — put the effect on by hand.");
    }
    // The caster's concentration effect, for origin linkage (concentration ?? effect); the
    // riders' origin walk handles both shapes downstream.
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

// ⚠ A CLAIM ON THE HEALING: a healing roll born with `healReroll` due waits for its dice to be
// read, and a pending one for the owner's answer (heal-rerolls.js), so the healing lands ONCE with
// the faces that stood — the damage's claim in auto-apply.js EITHER_WAITS, the same shape.
const HEAL_REROLL_WAITS = new Set(["due", "pending", "answering"]);
const healRerollWaits = message => HEAL_REROLL_WAITS.has(message.getFlag(MODULE_ID, "healReroll")?.status);

async function applyCastHealing(message) {
  try {
    if ( message.getFlag(MODULE_ID, "receipt") ) return; // applied (or reverted) already
    if ( healRerollWaits(message) ) return;               // the Healer's answer first (the claim above)
    // A SELF-aimed heal carries its target ON the stamp — the dnd5e targets snapshot is incidental
    // UI targeting for a range-self activity.
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

// The CASTER's flow elect drives stamped casts — on arrival, and on render for reload resume; the
// answered choice is the one UPDATE that resumes the cast. The subject is the caster, so a table
// with no GM lands its own casts; with a GM on, `drivesMomentFor` is `isActiveGM()`
// (ARCHITECTURE §3, the driver table).
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

/* ---------------------------------------------------------------------------------------------
 * THE CHOICE (EFFECT_CHOICES, the Effect Choices list): polish.js stamps the pending choice at
 * birth; the popup opens on the caster's client (a GM answers for an unowned caster), the answer
 * is a fold onto the caster's OWN card, which the caster can always write, and the elect applies
 * only the pick. No clock: nobody else waits on a cast, and the card's button reopens the popup.
 * ------------------------------------------------------------------------------------------- */

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

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
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

