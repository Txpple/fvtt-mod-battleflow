/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE KIT TENDING — a feature that turns a kit's use on
 * a creature within reach into healing paid from THAT creature's Hit Point Dice (decide/registry.js
 * KIT_TENDS; Healer's Battle Medic the one row). The origin-feat walk, 2026-09-25 — the user:
 * "healer kit use --- if in 5 feet, give the 'caster' of healer kit option to choose hit dice and
 * make the roll for the other player"; "and then reroll 1 option".
 *
 * The pack ships Battle Medic as four bare activities ("Heal d6" … "Heal d12") and a note: the
 * creature spends its die on its own sheet and says which size. Here the kit's use is the moment.
 *
 * THE MOMENT is the kit's use (`dnd5e.postUseActivity`, the using client) by a listed feature's
 * owner with ONE target within the row's reach: the kit's usage card is stamped `kitTend` pending,
 * with the target's Hit Dice by size ("d10 · Fighter · 3 of 5 left"). THE POPUP opens on whoever
 * answers for the kit's user: one row per size, one pick, "Tend" / "Pass" (the clock passes; a Pass
 * leaves the kit's own use — stabilizing — as it was). THE LANDING is the flow elect's (the GM when
 * one is on): the target's die spent on its class, then the feature's OWN heal activity of that
 * size rolled at the target — so the Healing Rerolls popup (heal-rerolls.js) asks about a 1 and the
 * cast applier lands the healing, both unchanged.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, queueFlagWrite, canAnswerFor, canApplyTo, drivesMomentFor,
  statContext, whisperNoGM } from "./core.js";
import { lower, resolveUuid } from "./lookup.js";
import { kitTendEntries, listedNames } from "./settings.js";
import { KIT_TENDS } from "./decide/registry.js";
import { bfCard, esc, holdBarHTML, popupKey, foldedRuleHTML, tickRowsHTML } from "./decide/present.js";
import { targetsOf } from "./decide/card.js";
import { nearestFeet, tokenForUuid, tokenOfActor } from "./geometry.js";
import { withTargets } from "./shared.js";
import { livePopups, openMomentPopup, momentButton, shownMoments, scheduleBarSync, armDeadline, disarmDeadline,
  registerRelay, registerResumable } from "./ui.js";
import { SURFACES } from "./surfaces.js";

const TEND_FLAG = "kitTend";
const timers = new Map();

/** The listed row whose kit this is, held by the kit's user — `{ name, row, feature }` or null. */
function rowFor(actor, item) {
  const on = listedNames(kitTendEntries());
  for ( const [name, row] of Object.entries(KIT_TENDS) ) {
    if ( !on.has(lower(name)) || (lower(item?.name) !== lower(row.kit)) ) continue;
    const feature = actor?.items?.find(i => (i.type === "feat") && (lower(i.name) === lower(name)));
    if ( feature ) return { name, row, feature };
  }
  return null;
}

/** The die size a heal activity rolls — its denomination, or the first die of its custom formula. */
function healDieOf(activity) {
  const h = activity?.healing;
  if ( h?.denomination ) return Number(h.denomination);
  const m = /\d*d(\d+)/i.exec(h?.custom?.formula ?? "");
  return m ? Number(m[1]) : null;
}

/** The feature's own heal activity for a die size, or null. */
const healActivityFor = (feature, faces) =>
  [...(feature?.system?.activities ?? [])].find(a => (a.type === "heal") && (healDieOf(a) === faces)) ?? null;

/**
 * The creature's Hit Point Dice by size — a character's per class (dnd5e's own `hd` on each class
 * item), an NPC's from its own attributes. `{ key, faces, label, value, max }[]`.
 */
function hitDiceOf(actor) {
  const classes = Object.values(actor?.classes ?? {});
  if ( classes.length ) {
    return classes.map(c => ({ key: c.id, faces: Number(String(c.system?.hd?.denomination ?? "").replace(/^d/i, "")) || null,
      label: c.name, value: Number(c.system?.hd?.value) || 0, max: Number(c.system?.hd?.max) || 0 }))
      .filter(p => p.faces);
  }
  const hd = actor?.system?.attributes?.hd;
  const faces = Number(String(hd?.denomination ?? "").replace(/^d/i, "")) || null;
  if ( !faces || !Number.isFinite(Number(hd?.max)) ) return [];
  const max = Number(hd.max) || 0;
  return [{ key: "npc", faces, label: actor.name, value: Math.max(0, max - (Number(hd.spent) || 0)), max }];
}

/* --- the moment: the kit's use ------------------------------------------------------------------ */

Hooks.on("dnd5e.postUseActivity", (activity, _usage, results) => {
  try {
    const actor = activity?.actor;
    const found = rowFor(actor, activity?.item);
    const message = results?.message;
    if ( !found || !(message instanceof ChatMessage) ) return;
    // The card's snapshot of the targets; the using client's live ones when the card kept none.
    const snap = targetsOf(message);
    const targets = snap.length ? snap : [...(game.user?.targets ?? [])].map(t => ({ uuid: t.actor?.uuid ?? null })).filter(t => t.uuid);
    if ( targets.length !== 1 ) return;
    const target = resolveUuid(targets[0].uuid);
    const token = tokenForUuid(targets[0].uuid);
    const own = tokenOfActor(actor);
    if ( !(target instanceof Actor) || !token || !own ) return;
    const feet = (own === token) ? 0 : nearestFeet(own, token);
    if ( (feet === null) || (feet > found.row.reach) ) return;
    const pools = hitDiceOf(target).filter(p => healActivityFor(found.feature, p.faces));
    if ( !pools.length ) return;
    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    void message.setFlag(MODULE_ID, TEND_FLAG, {
      status: "pending", row: found.name, actorUuid: actor.uuid, actorName: actor.name, featureId: found.feature.id,
      targetUuid: target.uuid, targetName: token.name ?? target.name, pools, ...statContext(actor.uuid),
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
    }).catch(err => console.error(`${TITLE} | ${found.name} could not be offered — use its Heal activity by hand.`, err));
  } catch(err) {
    console.error(`${TITLE} | The kit's tending could not be offered — use the feature's Heal activity by hand.`, err);
  }
});

/* --- the answer: the GM folds it, a player sends it ------------------------------------------------ */

const settle = (current, answer, pick, timedOut = false) => {
  if ( current.status !== "pending" ) return false;
  const pool = (current.pools ?? []).find(p => (p.key === pick) && (p.value > 0)) ?? null;
  Object.assign(current, { status: "resolved", answer: (answer === "tend" && pool) ? "tend" : "pass",
    pick: pool?.key ?? null, answeredAt: Date.now(), ...(timedOut ? { timedOut: true } : {}) });
};

async function answerTend(message, answer, pick = null, { timedOut = false } = {}) {
  const flag = message.getFlag(MODULE_ID, TEND_FLAG);
  if ( flag?.status !== "pending" ) return;
  if ( isActiveGM() || !game.users.activeGM ) {
    await queueFlagWrite(message, TEND_FLAG, current => settle(current, answer, pick, timedOut));
    return;
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: resolveUuid(flag.actorUuid) }),
    content: "", whisper: game.users.filter(u => u.isGM).map(u => u.id),
    flags: { [MODULE_ID]: { kitTendAnswer: { messageId: message.id, answer, pick } } }
  });
}

registerRelay("kitTendAnswer", {
  flagKey: TEND_FLAG,
  targetOf: a => a.messageId,
  owns: () => isActiveGM(),
  cleanup: true,
  fold: (current, a) => settle(current, a.answer, a.pick)
});

/** The landing, on the flow elect: the target's die spent, then the feature's own heal of that size rolled at it. */
async function landTend(message) {
  let claimed = false;
  await queueFlagWrite(message, TEND_FLAG, current => {
    if ( (current.status !== "resolved") || (current.answer !== "tend") || current.applied || current.applying ) return false;
    current.applying = true;
    claimed = true;
  });
  if ( !claimed ) return;
  const flag = message.getFlag(MODULE_ID, TEND_FLAG);
  const record = {};
  try {
    const actor = resolveUuid(flag.actorUuid);
    const target = resolveUuid(flag.targetUuid);
    const pool = (flag.pools ?? []).find(p => p.key === flag.pick);
    const activity = healActivityFor(actor?.items?.get(flag.featureId), pool?.faces);
    const token = tokenForUuid(flag.targetUuid);
    if ( !(target instanceof Actor) || !pool || !activity || !token ) return;
    // The die first — the rule's order ("That creature can expend one of its Hit Point Dice, and
    // you then roll that die"). A client that may not write the creature says so, and rolls anyway.
    if ( canApplyTo(target) ) {
      if ( pool.key === "npc" ) {
        await target.update({ "system.attributes.hd.spent": (Number(target.system.attributes.hd.spent) || 0) + 1 });
      } else {
        const cls = target.items.get(pool.key);
        if ( cls ) await cls.update({ "system.hd.spent": (Number(cls.system.hd.spent) || 0) + 1 });
      }
      record.spent = true;
    } else {
      await whisperNoGM(`${flag.targetName}'s d${pool.faces} Hit Point Die`, "Spend it on the sheet by hand.");
    }
    await withTargets([token], async () => {
      await activity.use({ subsequentActions: false }, { configure: false }, { data: { flags: { [MODULE_ID]: { kitTendFor: message.id } } } });
      await activity.rollDamage({}, { configure: false }, { data: { flags: { [MODULE_ID]: { kitTendFor: message.id } } } });
    });
    record.faces = pool.faces;
  } catch(err) {
    console.error(`${TITLE} | ${flag.row}'s tending failed — spend the die and use its Heal activity by hand.`, err);
  } finally {
    await queueFlagWrite(message, TEND_FLAG, current => { Object.assign(current, record, { applied: true, applying: false }); });
  }
}

registerResumable(TEND_FLAG, {
  pending: flag => (flag?.status === "resolved") && (flag.answer === "tend") && !flag.applied && !flag.applying,
  drives: flag => drivesMomentFor(flag?.actorUuid ?? null),
  drive: landTend
});

/* --- the clock: Pass, on whoever drives the owner's moments ---------------------------------------- */

function armTimer(message) {
  const flag = message.getFlag(MODULE_ID, TEND_FLAG);
  if ( (flag?.status !== "pending") || !flag.deadline || !drivesMomentFor(flag.actorUuid ?? null) ) return;
  armDeadline(timers, message.id, flag.deadline, async () => {
    const live = game.messages.get(message.id);
    if ( live?.getFlag(MODULE_ID, TEND_FLAG)?.status === "pending" ) await answerTend(live, "pass", null, { timedOut: true });
  });
}

/* --- the popup and the card -------------------------------------------------------------------------- */

async function showTendPopup(message) {
  const flag = message.getFlag(MODULE_ID, TEND_FLAG);
  if ( flag?.status !== "pending" ) return;
  const actor = resolveUuid(flag.actorUuid);
  if ( !actor ) return;
  const row = KIT_TENDS[flag.row] ?? null;
  const feature = actor.items.get(flag.featureId);
  const prof = Number(actor.system?.attributes?.prof) || 0;
  // The house tick rows (Savage Attacker's, the rescue's): one row per size, one tick at a time;
  // a size with no die left stays, greyed, its reason as the tag.
  const rows = (flag.pools ?? []).map(p => ({ key: p.key, name: `d${p.faces}`, dice: `${p.label} · 1d${p.faces} + ${prof}`,
    tag: `${p.value} of ${p.max} left`, off: (p.value > 0) ? null : "no Hit Dice left" }));
  const dialog = await openMomentPopup(message, TEND_FLAG, actor, {
    title: `${flag.row} — ${flag.actorName}`, icon: "fa-solid fa-kit-medical", width: 420,
    content: bfCard({ img: feature?.img ?? null, eyebrow: `Battle Medic — ${flag.row}`, tone: "pending",
      title: `Tend ${flag.targetName}?`,
      subtitle: `spend one of ${flag.targetName}'s Hit Point Dice · you roll it + ${prof}`,
      lines: [row?.rule ? foldedRuleHTML(esc(row.rule)) : ""] })
      + tickRowsHTML({ name: "bf-kit-tend", rows }) + holdBarHTML(flag, "to answer"),
    buttons: [
      { action: "tend", label: "Tend", callback: (_event, button) => {
        const pick = button.form.querySelector('input[name="bf-kit-tend"]:checked')?.value ?? null;
        void answerTend(message, pick ? "tend" : "pass", pick);
      } },
      { action: "pass", label: "Pass", callback: () => { void answerTend(message, "pass"); } }
    ]
  });
  // Tend is live once a size is ticked; the largest die with one left starts ticked.
  const form = dialog?.element?.querySelector?.("form") ?? dialog?.element ?? null;
  const tend = form?.querySelector?.('button[data-action="tend"]');
  const boxes = [...(form?.querySelectorAll?.('input[name="bf-kit-tend"]') ?? [])];
  if ( !tend ) return;
  const best = [...(flag.pools ?? [])].filter(p => p.value > 0).sort((a, b) => b.faces - a.faces)[0];
  for ( const b of boxes ) b.checked = (b.value === best?.key);
  const follow = ev => {
    if ( ev?.target?.checked ) for ( const b of boxes ) if ( b !== ev.target ) b.checked = false;
    tend.disabled = !boxes.some(b => b.checked);
  };
  for ( const b of boxes ) b.addEventListener("change", follow);
  follow();
}

/** The card's line — what was done, or that it waits. */
function tendLine(flag) {
  const pool = (flag.pools ?? []).find(p => p.key === flag.pick);
  if ( flag.answer === "tend" ) return flag.applied
    ? `${flag.row} — ${flag.targetName} spends a d${pool?.faces ?? "?"} Hit Point Die${flag.spent ? "" : " (by hand)"}; ${flag.actorName} rolls it`
    : `${flag.row} — tending ${flag.targetName} with a d${pool?.faces ?? "?"}…`;
  if ( flag.answer === "pass" ) return `${flag.row} — not used${flag.timedOut ? " (the clock ran out)" : ""}`;
  return `${flag.row} — tend ${flag.targetName} with one of their Hit Point Dice?`;
}

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, TEND_FLAG);
    if ( !flag ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-kit-tend-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-kit-tend-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-kit-medical"></i> ${esc(tendLine(flag))}`
      + ((flag.status === "pending") ? ` ${holdBarHTML(flag, "to answer")}` : "");
    if ( flag.status === "pending" ) {
      const actor = resolveUuid(flag.actorUuid);
      if ( canAnswerFor(actor) ) {
        const shown = popupKey(message.id, TEND_FLAG);
        if ( !shownMoments.has(shown) ) { shownMoments.add(shown); void showTendPopup(message); }
        div.appendChild(momentButton("Answer", () => { void showTendPopup(message); }));
      }
      scheduleBarSync(div);
      armTimer(message);
    }
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The kit-tend line could not render.`, err); }
});

// An answer anywhere closes the popup everywhere (law 4); the clock stands down with it.
Hooks.on("updateChatMessage", message => {
  const flag = message.getFlag(MODULE_ID, TEND_FLAG);
  if ( !flag ) return;
  if ( flag.status === "pending" ) { armTimer(message); return; }
  disarmDeadline(timers, message.id);
  const open = livePopups.get(popupKey(message.id, TEND_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
});

Hooks.on("deleteChatMessage", message => { disarmDeadline(timers, message.id); });
