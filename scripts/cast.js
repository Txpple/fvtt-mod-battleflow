/**
 * Battle Flow — Phase 3 (cast slice): the elect executes a stamped cast payload - utility effects and healing, receipts throughout.
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, canAnswerFor, isActiveGM, queueFlagWrite } from "./core.js";
import { damagePartsOf, statSourceOf } from "./shared.js";
import { bfCard, popupKey, ruleLine } from "./decide/present.js";
import { effectsAfterChoice } from "./decide/choices.js";
import { momentButton, openMomentPopup, shownMoments } from "./ui.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { applyEffectsWithReceipt } from "./effect-riders.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 3 (cast slice) — auto-apply on cast (ARCHITECTURE.md §6, pulled ahead 2026-08-16).
 *
 * A used activity with no outcome gate resolves at cast, on the elect: a utility activity's
 * effects land on every snapshot target (Bless, Mark Creature / Move Mark, Heroism), and a
 * heal activity's self-rolled healing lands through the shared applier — calculateDamage
 * negates healing-typed entries natively, and the "maximum"/"temphp" types ride the same
 * treatAs plumbing off the roll message we pass as originatingMessage (actor.mjs:807/:868).
 * Receipts + revert everywhere, as always.
 *
 * The bus: the STAMP is the trigger, never the setting. preCreate (initiating client) stamps
 * the `castApply` payload on a qualifying usage card — always the native card since v1.10.0
 * (the suppression machinery and its replacement bfCard are gone) — and `healPending` on a
 * targeted healing roll. The elect reacts to the flag from createChatMessage AND from the
 * render hook (the reload-resume discipline the v1.3.1 review established): an unstamped
 * message can never be applied, so rendering last week's log is inert by construction.
 *
 * Deliberately OUT: save activities (Phase 2 — their cards are load-bearing), bare damage
 * activities (Magic Missile is the negate hold's seam — auto-apply would beat a pending
 * hold's verdict), and enchant/summon/forward (not effects-on-target casts).
 * ------------------------------------------------------------------------------------------- */

/** Same-client concurrency latch — create + render can fire in one tick, same as the
 * mastery ask's executions latch and for the same reason. */
const castExecutions = new Set();

async function executeCastApply(message) {
  if ( castExecutions.has(message.id) ) return;
  castExecutions.add(message.id);
  try {
    const payload = message.getFlag(MODULE_ID, "castApply");
    if ( !payload?.targets?.length ) return;
    if ( message.getFlag(MODULE_ID, "effectReceipt")?.castDone ) return;
    const activity = payload.activityUuid ? await fromUuid(payload.activityUuid) : null;
    const applicable = activity?.applicableEffects ?? [];
    // A cast with a CHOICE between alternative effects (Fire Shield's warm or chill shield,
    // 2026-09-05) waits on the card until the caster answers; then only the pick lands.
    const names = effectsAfterChoice(applicable.map(e => e.name), payload.choice ?? null);
    if ( names === null ) return;   // pending — the caster's popup is open on their client
    const wanted = new Set(names.map(n => String(n).toLowerCase()));
    const effects = applicable.filter(e => wanted.has(String(e.name).toLowerCase()));
    if ( !effects.length ) return;
    // The caster's concentration effect, for origin linkage — the tray's own rule
    // (concentration ?? effect); the riders' origin walk handles both shapes downstream.
    const concentration = payload.concentration
      ? (activity?.actor?.effects.get(payload.concentration) ?? null) : null;
    await applyEffectsWithReceipt(message, effects, payload.targets, {
      concentration, scaling: payload.scaling ?? 0,
      spellLevel: payload.spellLevel ?? undefined,
      marker: "castDone",
      source: statSourceOf(message) // the data-plane stamp — the caster's own usage card
    });
  } catch(err) {
    console.error(`${TITLE} | Cast auto-apply failed.`, err);
  } finally {
    castExecutions.delete(message.id);
  }
}

async function applyCastHealing(message) {
  const key = `heal:${message.id}`;
  if ( castExecutions.has(key) ) return;
  castExecutions.add(key);
  try {
    if ( message.getFlag(MODULE_ID, "receipt") ) return; // applied (or reverted) already
    // A SELF-aimed heal carries its target ON the stamp (v1.11.0 self-aim, finding ① —
    // the dnd5e targets snapshot is incidental UI targeting for a range-self activity).
    const stamp = message.getFlag(MODULE_ID, "healPending");
    const targets = stamp?.selfAim
      ? [{ uuid: stamp.uuid, name: stamp.name }]
      : (message.getFlag("dnd5e", "targets") ?? []).map(t => ({ uuid: t.uuid, name: t.name }));
    if ( !targets.length ) return;
    const damages = damagePartsOf(message.rolls);
    if ( !damages.length ) return;
    await applyDamagesWithReceipt(message, targets, damages, { note: "Healing" });
  } catch(err) {
    console.error(`${TITLE} | Healing auto-apply failed.`, err);
  } finally {
    castExecutions.delete(key);
  }
}

/** The elect volunteers for stamped casts — on arrival, and on render for reload resume. */
function resolveStampedCast(message) {
  if ( !isActiveGM() ) return;
  if ( message.getFlag(MODULE_ID, "castApply") ) void executeCastApply(message);
  if ( message.getFlag(MODULE_ID, "healPending") ) void applyCastHealing(message);
}
Hooks.on("createChatMessage", resolveStampedCast);
Hooks.on("dnd5e.renderChatMessage", message => resolveStampedCast(message));
// The choice answered (the caster's flag write below) — the elect applies the pick.
Hooks.on("updateChatMessage", message => { if ( message.getFlag(MODULE_ID, "castApply")?.choice?.chosen ) resolveStampedCast(message); });

/* ---------------------------------------------------------------------------------------------
 * THE CHOICE (user, 2026-09-05: "when i apply warm or chill shield, it applies both … this
 * should also be a popup asking the player which shield to apply") — the moment spine, on the
 * caster's own usage card. polish.js stamps the pending choice at birth (EFFECT_CHOICES, the
 * Effect Choices list); the popup opens on the caster's client (a GM answers for an unowned
 * caster — the hold's `canAnswerFor`), the answer is a fold onto the caster's OWN card, which
 * the caster can always write, and the elect applies only the pick. No clock: a cast is the
 * caster's own moment, nobody else is waiting on it, and the card's button reopens the popup.
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
  let item = null;
  try { item = fromUuidSync(card.getFlag("dnd5e", "item")?.uuid ?? ""); } catch { item = null; }
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
  html.querySelector(".message-content")?.appendChild(line);
  if ( choice.chosen ) return;
  const actor = payload.targets?.[0]?.uuid ? fromUuidSync(payload.targets[0].uuid) : null;
  if ( !canAnswerFor(actor) ) return;
  const shownKey = popupKey(message.id, "effectChoice");
  if ( !shownMoments.has(shownKey) ) { shownMoments.add(shownKey); void showChoicePopup(message); }
  line.appendChild(momentButton(`Choose — ${choice.key}`, () => void showChoicePopup(message)));
});

