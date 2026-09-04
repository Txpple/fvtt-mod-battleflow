/**
 * Battle Flow — Phase 1a: auto-roll damage on hit, on the attacker's own client.
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting } from "./core.js";
import { hitTargets, modeAllows } from "./shared.js";
import { TONE } from "./decide/present.js";
import { CONDITION_BENDS } from "./decide/registry.js";
import { autoCritSources } from "./decide/reminders.js";
import { nearestFeet, tokenForUuid, tokenOfActor } from "./geometry.js";
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
  // An ARMED SNEAK ATTACK opens the offer whatever the setting (user, 2026-09-02: "even with
  // auto damage on, because there is a decision to make" — which Cunning Strike, if any).
  // …and so does a CLOCK RIDER the rules make available (user ruling, the same evening: a
  // checkbox, optional — so the offer is where the choice lives).
  // …and so does any contribution with a decision pending (`registerOfferPart` — the sneak
  // machine, the clock riders, the hit menu declare their own `due`).
  if ( setting(S.playerRollDamage) || offerPartsDue(attackMessage, subject) ) {
    return void offerDamageRoll(subject, attackMessage);
  }

  const beat = (Math.max(0, Number(setting(S.dramaticBeat)) || 0)) * 1000;
  setTimeout(() => rollDamageForAttack(subject, attackMessage), beat);
});

/* ---------------------------------------------------------------------------------------------
 * THE CRIT, ONE SOURCE (user, 2026-09-02 — "an attack within 5 feet of paralyzed auto crits").
 * A hit is critical when the d20 said so (the roll's own `isCritical`) OR when the target's
 * condition says so from where the attacker stands: the glossary's *Automatic Critical Hits*
 * clause on Paralyzed and Unconscious, carried as `critWithinFeet` on the condition table and
 * judged by decide/reminders.js `autoCritSources` over the distance the reminder gate measures.
 * An OUTCOME (R1 automates outcomes), so the damage roll is MADE critical — at every path that
 * rolls it: the module's own drive passes it, and the pre-roll-damage hook below catches the
 * card's Damage button too — and the offer's badge reads this same function, so the badge and
 * the dice cannot disagree. ⚠ One damage roll serves every target it hit, so the crit is applied
 * only when it is true of ALL of them (hit-riders' intersection rule; over-applying damage is
 * the worst failure this module has); the dropped case is said on the offer, never swallowed.
 * ------------------------------------------------------------------------------------------- */

/**
 * @param {ChatMessage} attackMessage
 * @returns {{isCritical: boolean, rolled: boolean, auto: boolean,
 *            sources: {status: string, label: string, rule: string}[], dropped: string[]}}
 */
export function critFor(attackMessage) {
  const rolled = attackMessage?.rolls?.[0]?.isCritical ?? false;
  const out = { isCritical: rolled, rolled, auto: false, sources: [], dropped: [] };
  try {
    const hits = hitTargets(attackMessage);
    if ( !hits.length ) return out;
    const attackerToken = tokenOfActor(attackMessage.getAssociatedActor());
    const per = hits.map(t => {
      const token = tokenForUuid(t.uuid);
      const actor = token?.actor ?? (() => { try { return fromUuidSync(t.uuid); } catch { return null; } })();
      const distanceFeet = (attackerToken && token) ? nearestFeet(attackerToken, token) : null;
      return { name: t.name ?? actor?.name ?? "the target",
        sources: autoCritSources({ targetStatuses: actor?.statuses ?? [], distanceFeet,
          targetName: token?.document?.name ?? actor?.name ?? "the target", table: CONDITION_BENDS }) };
    });
    const qualifying = per.filter(p => p.sources.length);
    if ( !qualifying.length ) return out;
    if ( qualifying.length === per.length ) {
      out.auto = true;
      out.isCritical = true;
      out.sources = per.flatMap(p => p.sources);
    } else {
      out.dropped = qualifying.map(p => p.name);
    }
  } catch(err) {
    console.error(`${TITLE} | Automatic crit judgement failed — the d20's own verdict stands.`, err);
  }
  return out;
}

/**
 * The attack an about-to-roll damage answers, from the roll's message DATA (no document yet):
 * the module's own drives stamp `attackFor`; the card's Damage button carries the click, whose
 * enclosing card is the usage card and whose last attack roll is the one (dnd5e's own
 * #rollDamage reads it the same way); the flat originatingMessage key is the sheet shape.
 */
export function attackMessageForDamage(config, message) {
  const data = message?.data ?? {};
  const forId = data[`flags.${MODULE_ID}.attackFor`] ?? foundry.utils.getProperty(data, `flags.${MODULE_ID}.attackFor`);
  if ( forId ) return game.messages.get(forId) ?? null;
  const cardId = config?.event?.target?.closest?.("[data-message-id]")?.dataset?.messageId
    ?? data["flags.dnd5e.originatingMessage"] ?? foundry.utils.getProperty(data, "flags.dnd5e.originatingMessage");
  const card = cardId ? game.messages.get(cardId) : null;
  if ( !card ) return null;
  if ( card.getFlag("dnd5e", "roll.type") === "attack" ) return card;
  return card.getAssociatedRolls?.("attack")?.pop() ?? null;
}

// The hook is what makes the card's own Damage button honour it: dnd5e reads the d20's crit
// off the attack message and passes `isCritical` into this config; `applyKeybindings` runs
// AFTER this hook and stamps `config.isCritical` onto every roll (hit-riders.js's note on the
// order). Setting it here is exactly what a nat 20 sets. The fact rides the damage message
// as a flag, so the card can say why the dice doubled (R5).
Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
  try {
    if ( config?.subject?.type !== "attack" ) return;
    const attackMessage = attackMessageForDamage(config, message);
    if ( !attackMessage ) return;
    const crit = critFor(attackMessage);
    if ( !crit.auto ) return;
    config.isCritical = true;
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.autoCrit`,
      { sources: crit.sources.map(s => ({ status: s.status, label: s.label })), attackId: attackMessage.id });
  } catch(err) {
    console.error(`${TITLE} | Automatic crit failed to apply — the d20's own verdict stands.`, err);
  }
});

// The damage card SAYS why it doubled (R5): the badge and the fact, under the roll.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const auto = message.getFlag(MODULE_ID, "autoCrit");
  if ( !auto?.sources?.length ) return;
  const line = document.createElement("div");
  line.style.cssText = "margin:0.3rem 0;font-size:var(--font-size-12,12px);line-height:1.5;";
  line.innerHTML = `${CRIT_BADGE} <span style="opacity:0.85;">${auto.sources.map(s => s.label).join(" · ")}</span>`;
  html.querySelector(".message-content")?.appendChild(line);
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
    const isCritical = critFor(attackMessage).isCritical;
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
    // A demand raised off a usage card carries the cast's own scaling in the system's message
    // data. An emanation's TRIGGERED demand (emanations.js, 2026-09-03) is a plain card, so it
    // carries the upcast level on the demand itself — passed through, never re-derived.
    const scaling = Number(card.getFlag(MODULE_ID, "saves")?.scaling ?? 0);
    await activity.rollDamage(scaling > 0 ? { scaling } : {}, { configure: false },
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
  background:${TONE.crit};color:#111;font-weight:bold;letter-spacing:0.07em;
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
async function offerRoll(message, { roll, windowTitle, windowIcon, buttonLabel, buttonIcon, extraHTML = "", wire = null, ...card }) {
  // ⚠ Lazily bound, the same discipline hold.js and saves.js keep (v1.6.1's ESM order trap).
  // A STATIC import of ui.js here evaluates it during THIS file's own import — the entry reaches
  // auto-damage.js through polish.js -> hold.js, at which point hold has not yet reached its own
  // ui import — which runs ui.js's body, and its renderChatMessage/deleteChatMessage
  // registrations, ahead of this file's. Measured with check-hook-order: the static form moves
  // them, the dynamic form leaves the whole evaluation order byte-identical. Keep this dynamic.
  const { popupKey, bfCard, momentBarHTML } = await import("./decide/present.js");
  const { livePopups, openManagedPopup } = await import("./ui.js");

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
    // ⚠ THE BUTTON MUST STAY ON SCREEN (user walk 2026-09-02): a rogue with Improved Cunning
    // Strike and the Thief's Stealth Attack draws eight menu rows under the card, and DialogV2
    // sizes to its content — the footer walked off the bottom of the viewport and the roller
    // had no Roll to press. The menus scroll inside a viewport-bounded box; the card and the
    // footer stay put.
    content: bfCard({ tone: "pending", ...card })
      + (extraHTML ? `<div data-bf-offer-menus style="max-height:calc(100vh - 20rem);overflow-y:auto;overflow-x:hidden;">${extraHTML}</div>` : "")
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
  if ( livePopups.get(key) !== dialog ) return fire();
  // A flavour with live controls (the Cunning Strike menu) wires them once the DOM stands.
  if ( wire ) { try { wire(dialog.element); } catch(err) { console.error(`${TITLE} | Offer controls failed to wire.`, err); } }
}

/**
 * THE OFFER'S CONTRIBUTIONS (2026-09-04 — the seam the third instance proved, BACKLOG's "the
 * damage offer's three lazy edges"). The damage offer is a SERVICE: it owns the popup, the clock
 * and the one roll thunk, and it knows nothing about any feature. What a feature paints on the
 * offer — the armed Cleave line, the Cunning Strike menu, the due clock riders, the hit menu —
 * is declared INTO it by the machine that owns the content, at module evaluation, the relay's
 * and the rescue's idiom (ui.js `registerRelay` / `registerRescue`). Before this the offer
 * imported each machine lazily and named its functions, one PERMANENT layer pin per machine and
 * a fourth waiting on the hit menu; now the edge points downward (machine → service) and the
 * offer walks a list.
 *
 * A part declares:
 *   due(attackMessage, activity)          → true when the offer must OPEN even under auto damage
 *                                           — there is a decision pending (an armed Sneak Attack,
 *                                           a due clock rider, an affordable maneuver)
 *   parts(attackMessage, activity, ctx)   → null, or `{ html, lines, wire(element), commit() }`:
 *                                           the menu markup, the notice lines, the live controls,
 *                                           and what to write on the attack message BEFORE the
 *                                           dice. `ctx.isCritical` is the crit as the offer knows
 *                                           it (critFor — one source).
 *
 * The order on the offer is the order of registration, which is the entry's import order —
 * the Cleave line, the Cunning Strike menu, the clock riders, the hit menu.
 */
const offerParts = [];

/** Declare a contribution to the damage offer. Called at module evaluation by a machine. */
export function registerOfferPart(part) {
  offerParts.push(part);
}

/** Is any contribution waiting on a decision for this hit? The offer opens for it whatever the auto-damage setting. */
function offerPartsDue(attackMessage, activity) {
  return offerParts.some(p => {
    try { return !!p.due?.(attackMessage, activity); }
    catch(err) { console.error(`${TITLE} | An offer contribution (${p.key}) failed its due check.`, err); return false; }
  });
}

/** Every contribution's parts for this hit, in registration order, the failed ones dropped with a note. */
function offerPartsFor(attackMessage, activity, ctx) {
  const out = [];
  for ( const p of offerParts ) {
    try {
      const parts = p.parts?.(attackMessage, activity, ctx);
      if ( parts ) out.push(parts);
    } catch(err) {
      console.error(`${TITLE} | An offer contribution (${p.key}) failed to render — the offer opens without it.`, err);
    }
  }
  return out;
}

/**
 * Ask the ATTACKER to roll their own damage, with a `damageTimer` buzzer that rolls it for them.
 */
export async function offerDamageRoll(activity, attackMessage) {
  // ⚠ ONE SOURCE FOR THE CRIT — `critFor`: the roll's own verdict, or the condition's 5-foot
  // clause. `rollDamageForAttack` and the pre-roll-damage hook read the same function to decide
  // what they roll, so the badge cannot disagree with the dice. Deriving it instead from the
  // d20 face and a crit threshold would be a second opinion about a settled fact — and a second
  // opinion on a card people trust is worse than no badge at all.
  const crit = critFor(attackMessage);
  const isCritical = crit.isCritical;
  const against = againstLine(hitTargets(attackMessage));
  // What the machines paint on this offer (the seam above): the armed Cleave line, the Cunning
  // Strike menu, the due clock riders, the hit menu — each machine owns its content, this
  // service owns the popup. Every pick is committed onto the attack message inside the one roll
  // thunk, BEFORE the dice, where the machines' rider hooks read it.
  const parts = offerPartsFor(attackMessage, activity, { isCritical });

  // THE CELEBRATION (ARCHITECTURE.md §5 law 10, finding (l)): every attack-damage popup leads
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
    roll: async () => { for ( const p of parts ) await p.commit?.(); return rollDamageForAttack(activity, attackMessage); },
    windowTitle: headline,
    windowIcon: isCritical ? "fa-solid fa-burst" : "fa-solid fa-dice-d6",
    buttonLabel: isCritical ? "Roll Critical Damage" : "Roll Damage",
    buttonIcon: isCritical ? "fa-solid fa-burst" : "fa-solid fa-dice-d6",
    extraHTML: parts.map(p => p.html ?? "").join(""),
    wire: parts.some(p => p.wire) ? element => { for ( const p of parts ) p.wire?.(element); } : null,
    img: activity.item?.img,
    eyebrow: "Damage — your roll",
    title: headline,
    subtitle: `${activity.item?.name ?? "Attack"} — ${attackMessage.getAssociatedActor()?.name ?? ""}`,
    lines: [
      riposte ? `<strong>Riposte</strong> — the superiority die rides this roll${isCritical ? " and crit-doubles with it" : ""}.` : null,
      precisionUsed ? `<strong>Precision Attack</strong> turned the miss — this hit is yours to roll.` : null,
      ...parts.flatMap(p => p.lines ?? []),
      isCritical ? `${CRIT_BADGE} <span style="opacity:0.85;">${crit.auto && !crit.rolled
        ? `${crit.sources.map(s => s.label).join(" · ")} — set on the roll, nothing extra to do.`
        : "Already set on the roll — nothing extra to do."}</span>` : null,
      crit.dropped.length ? `<span style="opacity:0.85;">${crit.dropped.join(", ")} would take a Critical Hit (Paralyzed or Unconscious, within 5 feet), but this one roll also serves a target that would not — roll that damage by hand.</span>` : null,
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
