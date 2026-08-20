/**
 * Battle Flow — Phase 1a: auto-roll damage on hit, on the attacker's own client.
 * Split from battleflow.js (design.md §9); battleflow.js is the only esmodules entry.
 */
import { TITLE, S, setting } from "./core.js";
import { hitTargets, modeAllows } from "./shared.js";
import { stampHoldIfInterrupted } from "./hold.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 1a — auto-roll damage on hit (the attacker's client; its attack, its dice)
 * ------------------------------------------------------------------------------------------- */

Hooks.on("dnd5e.rollAttackV2", async (rolls, { subject }) => {
  // The mode gates on the ATTACKER's side of the table, and this hook runs on whichever client
  // rolled — so "npc" is in practice the GM's client and "pc" a player's own. Everything
  // downstream is side-agnostic: auto-apply is the GM elect regardless of who attacked, and a
  // hold's continuation follows the roller (see isContinuingClient).
  if ( !subject || !modeAllows(subject.actor) ) return;

  const attackMessage = rolls[0]?.parent;
  if ( !(attackMessage instanceof ChatMessage) ) return; // rolled with create:false — no chain to ride

  // Mirror the native card: no Damage button (no damage parts, no ammo), nothing to roll.
  if ( !subject.damage?.parts?.length && !subject.item?.system.properties?.has("amm") ) return;

  const hits = hitTargets(attackMessage);
  if ( !hits.length ) return; // a miss means the damage dice never exist

  // The one legitimate interrupt: someone hit is holding a Shield-class reaction. Pause here
  // rather than rolling damage, and let a human answer (design.md §5 Phase 1.5).
  if ( await stampHoldIfInterrupted(attackMessage, rolls[0], hits) ) return;

  // The player asked for their own dice back: offer the roll instead of taking it. The popup
  // IS the pause, so it ABSORBS the dramatic beat rather than stacking a 15s window behind a
  // 3s wait (FLOW item 3, decision 2) — a beat is a held breath, and you cannot hold one twice.
  if ( setting(S.playerRollDamage) ) return void offerDamageRoll(subject, attackMessage);

  const beat = (Math.max(0, Number(setting(S.dramaticBeat)) || 0)) * 1000;
  setTimeout(() => rollDamageForAttack(subject, attackMessage), beat);
});

/**
 * Press the Damage button the way AttackActivity.#rollDamage does at 5.3.3: recover attack
 * mode and ammunition from the attack message's flags — including the stored copy of
 * ammunition destroyed by consumption — pre-set critical, skip the dialog. The
 * originatingMessage is stamped explicitly because a programmatic roll has no DOM click to
 * inherit it from; without it the damage message never registers and auto-apply can't chain.
 */
export async function rollDamageForAttack(activity, attackMessage) {
  try {
    const attackMode = attackMessage.getFlag("dnd5e", "roll.attackMode");
    let ammunition;
    const actor = attackMessage.getAssociatedActor();
    if ( actor ) {
      const storedData = attackMessage.getFlag("dnd5e", "roll.ammunitionData");
      ammunition = storedData
        ? new Item.implementation(storedData, { parent: actor })
        : actor.items.get(attackMessage.getFlag("dnd5e", "roll.ammunition"));
    }
    const isCritical = attackMessage.rolls[0]?.isCritical ?? false;
    const originId = attackMessage.getFlag("dnd5e", "originatingMessage") ?? attackMessage.id;
    await activity.rollDamage(
      { ammunition, attackMode, isCritical },
      { configure: false },
      { data: { "flags.dnd5e.originatingMessage": originId } }
    );
  } catch(err) {
    console.error(`${TITLE} | Auto-roll damage failed.`, err);
  }
}


/* ---------------------------------------------------------------------------------------------
 * The player's own roll (FLOW item 3) — offered, never taken
 *
 * A player asked for their dice back: "give me a Roll Damage button, and roll it anyway if I
 * miss it." That is the whole feature, and it is cheap for one reason — `dnd5e.rollAttackV2`
 * fires on WHICHEVER CLIENT ROLLED, so this popup lands on the attacker's own screen with no
 * elect, no canAnswerFor and nothing crossing the wire. It is the first table moment in this
 * module that needs no card, because nobody else is waiting on it.
 *
 * ⚠ THE PROPERTY THAT STOPS IT FORKING THE MACHINE: the button and the buzzer call the SAME
 * `rollDamageForAttack()`. Crit, ammunition, attack mode and `originatingMessage` are
 * byte-identical either way, so auto-apply, the riders and the receipts cannot tell who
 * pressed it — and the worst case of every failure path below is today's behaviour.
 *
 * ⚠ KNOWN LIMIT, deliberately not engineered around: the window lives in a `setTimeout` on one
 * client, so an F5 mid-popup loses the roll (today's 3s beat has the same hole, 5x narrower).
 * Making it survive a reload means a flag, a re-render popper and an elect for "who rolls if
 * the roller never comes back" \u2014 the exact cross-client machinery whose absence makes this
 * item small. If it ever bites at the table, that is the follow-up; the GM rolls it by hand.
 * ------------------------------------------------------------------------------------------- */

/** The family's window (hold / save / concentration all 15s). One switch, not two. */
const PLAYER_ROLL_WINDOW = 15;

/**
 * The crit badge. Loud on purpose and NEVER shown on a guess — see the single source below.
 */
const CRIT_BADGE = `<span style="display:inline-block;padding:0.05rem 0.45rem;border-radius:3px;
  background:rgba(190,140,40,0.95);color:#fff;font-weight:bold;letter-spacing:0.07em;
  font-size:var(--font-size-11,11px);text-transform:uppercase;">&#10022; Critical Hit</span>`;

/**
 * Ask the attacker to roll their own damage, with a 15-second buzzer that rolls it for them.
 *
 * ONE POPUP PER ATTACK, never per target (HANDOFF standing item 1): one damage roll serves
 * every target the attack hit, so asking twice would be asking about dice that do not exist.
 * `popupKey` + `livePopups` make that structural — a second call while one is open raises the
 * open one instead of stacking a twin.
 */
export async function offerDamageRoll(activity, attackMessage) {
  // ⚠ Lazily bound, the same discipline hold.js and saves.js keep (v1.6.1's ESM order trap).
  // A STATIC import of ui.js here evaluates it during THIS file's own import — the entry reaches
  // auto-damage.js through polish.js -> hold.js, at which point hold has not yet reached its own
  // ui import — which runs ui.js's body, and its renderChatMessage/deleteChatMessage
  // registrations, ahead of this file's. Measured with check-hook-order: the static form moves
  // them, the dynamic form leaves the whole evaluation order byte-identical. Keep this dynamic.
  const { livePopups, popupKey, openManagedPopup, bfCard, holdBarHTML } = await import("./ui.js");

  const key = popupKey(attackMessage.id, "damage");
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return; }

  // ⚠ ONE SOURCE FOR THE CRIT, and it is the roll's own. `rollDamageForAttack` reads this exact
  // expression to decide what it rolls, so the badge cannot disagree with the dice. Deriving it
  // instead from the d20 face and a crit threshold would be a second opinion about a settled
  // fact — and a second opinion on a card people trust is worse than no badge at all.
  const isCritical = attackMessage.rolls[0]?.isCritical ?? false;
  const names = hitTargets(attackMessage).map(t => t.name).filter(Boolean).join(", ");
  const deadline = Date.now() + (PLAYER_ROLL_WINDOW * 1000);

  // Idempotent by construction: the button, the dismissal and the buzzer all come through here,
  // and only the first one through rolls. Everything else is a no-op, which is why none of the
  // paths below need to know about each other.
  let fired = false;
  const fire = () => {
    if ( fired ) return;
    fired = true;
    void rollDamageForAttack(activity, attackMessage);
  };

  const dialog = new foundry.applications.api.DialogV2({
    window: {
      title: isCritical ? "Critical Hit — roll damage" : "Roll damage",
      icon: isCritical ? "fa-solid fa-burst" : "fa-solid fa-dice-d6"
    },
    position: { width: 420 },
    content: bfCard({
      img: activity.item?.img,
      eyebrow: "Damage — your roll",
      tone: "pending",
      title: isCritical ? "Critical hit — roll it" : "Roll your damage",
      subtitle: `${activity.item?.name ?? "Attack"} — ${attackMessage.getAssociatedActor()?.name ?? ""}`,
      lines: [
        isCritical ? `${CRIT_BADGE} <span style="opacity:0.85;">Already set on the roll — nothing extra to do.</span>` : null,
        names ? `Against <strong>${names}</strong>.` : null
      ]
    }) + holdBarHTML({ status: "pending", deadline, window: PLAYER_ROLL_WINDOW }, "to roll"),
    buttons: [{
      action: "roll",
      label: isCritical ? "Roll Critical Damage" : "Roll Damage",
      icon: isCritical ? "fa-solid fa-burst" : "fa-solid fa-dice-d6",
      default: true,
      callback: () => fire()
    }],
    rejectClose: false
  });

  // Dismissing is not a veto \u2014 it is "stop asking me, get on with it", so the X and Escape roll
  // IMMEDIATELY rather than leaving the table sitting in silence until the buzzer. The guard in
  // `fire` is what makes this safe to stack under the button's own callback.
  const close = dialog.close.bind(dialog);
  dialog.close = (...args) => { fire(); return close(...args); };

  // The buzzer. Unconditional on purpose: it does not test livePopups, so it still rolls even
  // if the popup never rendered or was closed by something this function never hears about.
  setTimeout(() => { void dialog.close(); }, PLAYER_ROLL_WINDOW * 1000);

  await openManagedPopup(key, attackMessage, dialog);

  // A render that failed leaves NO surface to press: Hide Redundant Buttons is world-default ON,
  // so the native Damage button is not there to fall back to. Roll now rather than make the
  // table wait 15 seconds for a popup that does not exist.
  if ( livePopups.get(key) !== dialog ) fire();
}
