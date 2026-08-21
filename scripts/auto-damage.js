/**
 * Battle Flow — Phase 1a: auto-roll damage on hit, on the attacker's own client.
 * Split from battleflow.js (design.md §9); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting } from "./core.js";
import { hitTargets, modeAllows } from "./shared.js";
import { stampHoldIfInterrupted } from "./hold.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** (hh): the "Against …" line names each target with its token icon (law 8 tooltip) —
 * the roll popup was the one volley surface still naming targets in text alone. Pure
 * render off the roll's own snapshot; a target without an image degrades to its name.
 * ⚠ `display:inline-block` is load-bearing (the T4/T5 close-out's one visual): the
 * dialog stylesheet blocks imgs, which stacked "Against / icon / Gren." on three lines —
 * an inline style is the only thing that outranks it without touching the sheet. */
const againstLine = targets => {
  const list = (targets ?? []).filter(t => t?.name);
  if ( !list.length ) return null;
  return `Against ${list.map(t =>
    `${t.img ? `<img src="${esc(t.img)}" alt="${esc(t.name)}" data-tooltip="${esc(t.name)}"
      style="display:inline-block;width:18px;height:18px;border:none;border-radius:3px;object-fit:cover;vertical-align:-4px;margin:0 2px 0 0;">` : ""}<strong>${esc(t.name)}</strong>`).join(", ")}.`;
};

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

  // The one legitimate interrupt: someone hit is holding a Shield-class reaction. Since the
  // v1.20.0 walk-1 ruling (gg) the hold pauses the APPLICATION, never the dice — "the shoudl
  // just roll damage, and not wait for shield" — exactly the darts' pattern item 6 walked.
  // The stamp still raises the popup and the clock; the roll below is born attackHoldPending
  // (rollDamageForAttack reads the hold), and the resolution releases or discards it.
  await stampHoldIfInterrupted(attackMessage, rolls[0], hits);

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
    // (ii): EVERY driven roll names the exact attack it answers — resolveAttackMessage
    // reads this stamp first, because the registry walk misattributes under a volley
    // (three rays share one usage card and "last attack before the damage" is ray 3 for
    // all of them once the offers open). (gg): a roll made while that attack's hold is
    // still open is additionally born claimed — the applier waits on the flag and the
    // hold's resolution releases it (a Shield-flipped target just drops out of hitTargets,
    // so its dice do nothing). The hold is read at ROLL time, not offer time: a hold that
    // resolved while the popup sat open needs no claim and applies straight.
    const holdPending = attackMessage.getFlag(MODULE_ID, "hold")?.status === "pending";
    await activity.rollDamage(
      { ammunition, attackMode, isCritical },
      { configure: false },
      { data: { "flags.dnd5e.originatingMessage": originId,
        [`flags.${MODULE_ID}.attackFor`]: attackMessage.id,
        ...(holdPending ? { [`flags.${MODULE_ID}.attackHoldPending`]: true } : {}) } }
    );
  } catch(err) {
    console.error(`${TITLE} | Auto-roll damage failed.`, err);
  }
}

/**
 * Roll a SAVE activity's damage, chained to its own usage card — the twin of the function above,
 * and deliberately its neighbour. It lives here rather than in saves.js for the property that
 * makes the whole family safe: the auto-roll and the player's button call ONE function, so
 * nothing downstream can tell who pressed it. Split across two files, the two paths drift.
 *
 * No attack mode, no ammunition and no crit — a save spell has none of them; the empty config is
 * exactly what saves.js passed inline before the popup existed, kept byte-for-byte so upcast
 * scaling and `damageOnSave` keep riding the native plumbing. `originatingMessage` is stamped
 * explicitly because a programmatic roll has no DOM click to inherit it from, and without it
 * `saveDamageMessages` never finds the roll and the verdict fold has nothing to apply.
 */
export async function rollDamageForSave(activity, card) {
  try {
    await activity.rollDamage({}, { configure: false },
      { data: { "flags.dnd5e.originatingMessage": card.id } });
  } catch(err) {
    console.error(`${TITLE} | Could not auto-roll the save spell's damage.`, err);
  }
}


/* ---------------------------------------------------------------------------------------------
 * The player's own roll (FLOW item 3) — offered, never taken
 *
 * A player asked for their dice back: "give me a Roll Damage button, and roll it anyway if I
 * miss it." That is the whole feature, and it is cheap for one reason — the hooks it hangs off
 * fire on WHICHEVER CLIENT ACTED, so the popup lands on that player's own screen with no elect,
 * no canAnswerFor and nothing crossing the wire. It is the first table moment in this module
 * that needs no card, because nobody else is waiting on it.
 *
 * TWO PATHS REACH IT, and the second was the v1.18.0 walk's only finding — the first shipped
 * answering attacks alone, which left every save spell and every area rolling its own dice
 * behind the player's back:
 *   • ATTACKS — `dnd5e.rollAttackV2` (this file), on hit. Carries the crit, because there is
 *     an attack roll to have critted.
 *   • SAVE SPELLS AND AREAS — `dnd5e.postUseActivity` (saves.js's demand stamp), at the stamp.
 *     Vicious Mockery, Fireball, Web. No crit; the stakes take the badge's slot.
 * Both hooks share the locality above, which is why the second path cost a card and a thunk
 * rather than a machine.
 *
 * ⚠ THE PROPERTY THAT STOPS IT FORKING THE MACHINE: on each path the button and the buzzer
 * call the SAME roll function — `rollDamageForAttack()` or `rollDamageForSave()`, never a
 * popup-only variant. Crit, ammunition, attack mode and `originatingMessage` are byte-identical
 * whoever pressed it, so auto-apply, the riders, the verdict fold and the receipts cannot tell
 * a player's dice from the machine's — and the worst case of every failure path below is
 * today's behaviour.
 *
 * ⚠ KNOWN LIMIT, deliberately not engineered around: the window lives in a `setTimeout` on one
 * client, so an F5 mid-popup loses the roll (today's 3s beat has the same hole, 5x narrower).
 * Making it survive a reload means a flag, a re-render popper and an elect for "who rolls if
 * the roller never comes back" — the exact cross-client machinery whose absence makes this
 * item small. If it ever bites at the table, that is the follow-up; the GM rolls it by hand.
 * ------------------------------------------------------------------------------------------- */

/** The family's window — `damageTimer` since walk-4 finding (w) (default 15 with the rest
 * of the family; 0 waits indefinitely and draws no bar). It graduated from a constant when
 * the wait became visible to the whole table, not just the roller. */
const playerRollWindow = () => Math.max(0, Number(setting(S.damageTimer)) || 0);

/**
 * The crit badge. Loud on purpose and NEVER shown on a guess — see the single source below.
 */
const CRIT_BADGE = `<span style="display:inline-block;padding:0.05rem 0.45rem;border-radius:3px;
  background:rgba(190,140,40,0.95);color:#fff;font-weight:bold;letter-spacing:0.07em;
  font-size:var(--font-size-11,11px);text-transform:uppercase;">&#10022; Critical Hit</span>`;

/**
 * The shell EVERY damage offer wears, and the reason there is only one of it: the button, the X
 * and the buzzer all funnel through ONE `roll` thunk, so no flavour can drift into rolling
 * something its twin would not have. The flavours differ in what the card SAYS and what `roll`
 * DOES — never in how the window behaves. A third flavour means writing copy, not re-deciding
 * what a dismissal means.
 *
 * ONE POPUP PER ROLL, never per target (HANDOFF standing item 1): one damage roll serves every
 * target, so asking twice would be asking about dice that do not exist. `popupKey` + `livePopups`
 * make that structural — a second call while one is open raises the open one instead of stacking
 * a twin. The key is keyed to the CARD's id, so an attack chain and a save chain cannot collide.
 */
async function offerRoll(message, { roll, windowTitle, windowIcon, buttonLabel, buttonIcon, ...card }) {
  // ⚠ Lazily bound, the same discipline hold.js and saves.js keep (v1.6.1's ESM order trap).
  // A STATIC import of ui.js here evaluates it during THIS file's own import — the entry reaches
  // auto-damage.js through polish.js -> hold.js, at which point hold has not yet reached its own
  // ui import — which runs ui.js's body, and its renderChatMessage/deleteChatMessage
  // registrations, ahead of this file's. Measured with check-hook-order: the static form moves
  // them, the dynamic form leaves the whole evaluation order byte-identical. Keep this dynamic.
  const { livePopups, popupKey, openManagedPopup, bfCard, momentBarHTML } = await import("./ui.js");

  const key = popupKey(message.id, "damage");
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return; }

  const window = playerRollWindow();
  const deadline = window ? Date.now() + (window * 1000) : null;

  // THE TABLE'S VIEW (walk-4 finding (w)): the wait is stamped on the card, so every client
  // renders the same draining bar the roller's popup runs — "we are waiting on dice" stops
  // being knowledge private to the one holding them. The roller authors this message, so the
  // write is theirs to make; failing to stamp must never block the offer itself.
  if ( deadline ) {
    void message.setFlag(MODULE_ID, "damageOffer", { status: "pending", deadline, window })
      .catch(() => { /* the popup still offers; only the table's bar is lost */ });
  }

  // Idempotent by construction: the button, the dismissal and the buzzer all come through here,
  // and only the first one through rolls. Everything else is a no-op, which is why none of the
  // paths below need to know about each other.
  let fired = false;
  const fire = () => {
    if ( fired ) return;
    fired = true;
    void roll();
    // The moment resolves: fold the card's bar everywhere. Merge-write keeps the deadline
    // for the record; the row gates on status alone.
    if ( deadline ) void message.setFlag(MODULE_ID, "damageOffer", { status: "done" })
      .catch(() => { /* a stale bar drains to empty and the next render drops it */ });
  };

  const dialog = new foundry.applications.api.DialogV2({
    window: { title: windowTitle, icon: windowIcon },
    position: { width: 420 },
    content: bfCard({ tone: "pending", ...card })
      + (deadline ? momentBarHTML({ deadline, window }, "to roll") : ""),
    buttons: [{
      action: "roll",
      label: buttonLabel,
      icon: buttonIcon,
      default: true,
      callback: () => fire()
    }],
    rejectClose: false
  });

  // Dismissing is not a veto — it is "stop asking me, get on with it", so the X and Escape roll
  // IMMEDIATELY rather than leaving the table sitting in silence until the buzzer. The guard in
  // `fire` is what makes this safe to stack under the button's own callback.
  const close = dialog.close.bind(dialog);
  dialog.close = (...args) => { fire(); return close(...args); };

  // The buzzer. Unconditional on purpose: it does not test livePopups, so it still rolls even
  // if the popup never rendered or was closed by something this function never hears about.
  // A 0 window arms nothing — the popup waits for a human, and only the X or the button roll.
  if ( window ) setTimeout(() => { void dialog.close(); }, window * 1000);

  await openManagedPopup(key, message, dialog);

  // A render that failed leaves NO surface to press: Hide Redundant Buttons is world-default ON,
  // so the native Damage button is not there to fall back to. Roll now rather than make the
  // table wait 15 seconds for a popup that does not exist.
  if ( livePopups.get(key) !== dialog ) fire();
}

/**
 * Ask the ATTACKER to roll their own damage, with a `damageTimer` buzzer that rolls it for them.
 */
export async function offerDamageRoll(activity, attackMessage) {
  // ⚠ ONE SOURCE FOR THE CRIT, and it is the roll's own. `rollDamageForAttack` reads this exact
  // expression to decide what it rolls, so the badge cannot disagree with the dice. Deriving it
  // instead from the d20 face and a crit threshold would be a second opinion about a settled
  // fact — and a second opinion on a card people trust is worse than no badge at all.
  const isCritical = attackMessage.rolls[0]?.isCritical ?? false;
  const against = againstLine(hitTargets(attackMessage));
  // The armed Cleave announces itself BEFORE the dice (v1.19.x finding ③ — the walk: "the
  // roll damage popup should make a note that it's a cleave"). Lazy import on purpose: a
  // static edge here drags mastery.js's imports ahead of hold.js in the §9 entry order.
  const { cleaveArmedFor } = await import("./mastery.js");
  const cleaveArm = cleaveArmedFor(activity.item);

  // THE CELEBRATION (design.md §4.3 law 5, finding (l)): every attack-damage popup leads
  // with the HIT — the moment the player earned — and the dice ask rides it. One design,
  // consistent flavors: crits get louder on the one badge; a riposte is named as itself
  // (finding (p) — its hit is the riposte's own moment, and the die-riding note explains
  // the roll that is about to look bigger than the weapon); a precision re-drive names the
  // maneuver that turned the miss. This is the single chokepoint — plain swings, riposte
  // drives and precision re-drives all celebrate here or not at all.
  const riposte = !!attackMessage.getFlag(MODULE_ID, "riposteFor");
  const precisionUsed = attackMessage.getFlag(MODULE_ID, "precision")?.outcome === "used";
  const headline = isCritical
    ? (riposte ? "Critical riposte! — roll damage" : "Critical hit! — roll damage")
    : (riposte ? "Your riposte hit! — roll damage" : "You hit! — roll damage");

  return offerRoll(attackMessage, {
    roll: () => rollDamageForAttack(activity, attackMessage),
    windowTitle: headline,
    windowIcon: isCritical ? "fa-solid fa-burst" : "fa-solid fa-dice-d6",
    buttonLabel: isCritical ? "Roll Critical Damage" : "Roll Damage",
    buttonIcon: isCritical ? "fa-solid fa-burst" : "fa-solid fa-dice-d6",
    img: activity.item?.img,
    eyebrow: "Damage — your roll",
    title: headline,
    subtitle: `${activity.item?.name ?? "Attack"} — ${attackMessage.getAssociatedActor()?.name ?? ""}`,
    lines: [
      riposte ? `<strong>Riposte</strong> — the superiority die rides this roll${isCritical ? " and crit-doubles with it" : ""}.` : null,
      precisionUsed ? `<strong>Precision Attack</strong> turned the miss — this hit is yours to roll.` : null,
      cleaveArm ? `<strong>Cleave</strong> — this is the armed Cleave swing: the ability modifier is dropped from this roll.` : null,
      isCritical ? `${CRIT_BADGE} <span style="opacity:0.85;">Already set on the roll — nothing extra to do.</span>` : null,
      against
    ]
  });
}

/**
 * Ask the CASTER to roll a save spell's damage — Vicious Mockery's d4, Fireball's 8d6, and every
 * area in between. The v1.18.0 walk's one finding: the popup answered attacks and nothing else,
 * because it only ever hung off `dnd5e.rollAttackV2`, and a save spell never rolls an attack.
 *
 * ⚠ NO CRIT BADGE, and that is not an omission — a save spell has no attack roll to crit on, so
 * there is no settled fact to report. The stakes line takes the badge's slot instead: what a
 * successful save does to this number is the thing the roller wants to know while the dice are
 * still in their hand.
 *
 * ⚠ WHY LEAVING THE ROLL HANGING IS SAFE, and the reason this stayed small: the save slice was
 * built order-independent from the start. `reconcileSaveDamage` applies chained damage on
 * ARRIVAL, verdicts or no verdicts, behind a receipt-gated latch — its own docstring reads
 * "damage before verdicts, verdicts before damage, or interleaved". A roll landing fifteen
 * seconds after the saves needs no new machinery; it is the case already handled.
 *
 * ⚠ THE AREA NOT PLACED YET (`awaitingTemplate` — cast Web bare, then place it) is offered the
 * roll ANYWAY, targetless. The dice do not need to know who they land on; only the application
 * does, and that waits for adoption regardless. Deferring the offer until the template lands
 * would invent a NEW way to stall — a spell nobody ever places would never roll at all — and
 * this family's rule is that the worst case of every failure path is today's behaviour.
 *
 * ⚠ RIDER DAMAGE NEVER REACHES HERE. The caller gates on `saveModulated`, which excludes
 * `onSave: "full"` (Web's burn clause, finding ③, 2026-08-17). Riding the caller's existing gate
 * rather than re-testing here is what stops this popup re-opening that door.
 */
export async function offerSaveDamageRoll(activity, card, { damageOnSave, targets, awaiting } = {}) {
  const against = againstLine(targets);
  // Deliberately the save popup's own phrasing (saves.js's stakes block), trimmed to sit beside
  // the dice: the caster and the target should read the same rule in the same words.
  const stake = (damageOnSave === "half") ? "A successful save <strong>halves</strong> it."
    : (damageOnSave === "none") ? "A successful save avoids it <strong>entirely</strong>."
    : null;

  return offerRoll(card, {
    roll: () => rollDamageForSave(activity, card),
    windowTitle: "Roll damage",
    windowIcon: "fa-solid fa-dice-d6",
    buttonLabel: "Roll Damage",
    buttonIcon: "fa-solid fa-dice-d6",
    img: activity.item?.img,
    eyebrow: "Damage — your roll",
    title: "Roll your damage",
    subtitle: `${activity.item?.name ?? "Spell"} — ${activity.actor?.name ?? ""}`,
    lines: [
      stake,
      against,
      // Says WHY the line above is missing, rather than leaving the roller to wonder.
      (awaiting && !against)
        ? `<span style="opacity:0.85;">The area is not placed yet — your dice can go first.</span>`
        : null
    ]
  });
}
