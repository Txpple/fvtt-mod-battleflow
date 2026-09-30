/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE INITIATIVE GRANTS (INITIATIVE_GRANTS — Persistent Rage, Uncanny
 * Metabolism). As a combatant's Initiative lands (the swap's seam, initiative-swap.js), the GM reads its listed
 * features once per combat: a plain row simply happens (R1) — its item's expended uses back, the feature's own use
 * spent, a card; an `ask` row is OFFERED to the owner (the use is theirs to keep) and the clock answers No. The
 * sheet writes are the GM's; a player's answer relays.
 */
import { MODULE_ID, TITLE, isActiveGM, queueFlagWrite, canAnswerFor, statContext, drivesMomentFor, decisionWindow } from "./core.js";
import { activityNamed, featureNamed, lower, resolveUuid } from "./lookup.js";
import { poolOf, spendPoolUses } from "./shared.js";
import { nearestFeet, tokenForUuid } from "./geometry.js";
import { INITIATIVE_GRANTS, initiativeGrantEntries, listedNames } from "./decide/registry.js";
import { initiativeGrantDue, initiativeGrantLine } from "./decide/initiative-grants.js";
import { riderPartFormula } from "./decide/clock.js";
import { bfCard, esc, holdBarHTML, popupKey, foldedRuleHTML } from "./decide/present.js";
import { livePopups, openMomentPopup, momentButton, shownMoments, scheduleBarSync, armDeadline, disarmDeadline,
  registerRelay, registerResumable } from "./ui.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const INITIATIVE_GRANT_FLAG = "initiativeGrant";
/** The combat's own latch — which combatant has been read for which row (once per combat). */
const INITIATIVE_READ_FLAG = "initiativeGrantRead";
/** B4 — the combat's own note of a bonus DUE to combatants who had not rolled when a `to: "allies"` grant landed. */
const BONUS_DUE_FLAG = "initiativeBonusDue";
const timers = new Map();

const usesOf = item => ({ value: Number(item?.system?.uses?.value ?? 0), max: Number(item?.system?.uses?.max ?? 0),
  spent: Number(item?.system?.uses?.spent ?? 0) });

/** The heal activity's amount as a formula resolved on the owner's sheet ("1d8 + 5"), or null. */
function healFormulaOf(actor, activity) {
  const h = activity?.healing;
  const raw = h ? riderPartFormula({ number: h.number, denomination: h.denomination, custom: h.custom, bonus: h.bonus }) : null;
  try {
    const resolved = raw ? Roll.replaceFormulaData(raw, actor.getRollData()) : null;
    return (resolved && Roll.validate(resolved)) ? resolved : null;
  } catch { return null; }
}

/** The listed rows this actor's sheet holds, each with what it would do now. */
function grantsFor(actor) {
  const on = listedNames(initiativeGrantEntries());
  const out = [];
  for ( const [name, row] of Object.entries(INITIATIVE_GRANTS) ) {
    if ( !on.has(lower(name)) ) continue;
    const item = featureNamed(actor, name);
    if ( !item ) continue;
    // B4 — a `to: "allies"` row: the activity's roll on the owner's numbers, its consumption the pool (a use must stand).
    if ( row.to === "allies" ) {
      const activity = row.activity ? activityNamed(item, row.activity) : null;
      const pool = activity ? (poolOf(actor, activity) ?? item) : null;
      let formula = null;
      try { formula = activity?.roll?.formula ? Roll.replaceFormulaData(String(activity.roll.formula), actor.getRollData()) : null; } catch { formula = null; }
      if ( !activity || !pool || !formula || !Roll.validate(formula) || !(Number(pool.system?.uses?.value ?? 0) > 0) ) continue;
      out.push({ name, row, item, regain: null, heal: null, give: { activity, pool, formula } });
      continue;
    }
    const regain = featureNamed(actor, row.regain);
    if ( !regain ) continue;
    const heal = row.heal ? activityNamed(item, row.heal) : null;
    const hp = actor.system?.attributes?.hp ?? null;
    const due = initiativeGrantDue({ own: usesOf(item), regain: usesOf(regain), heals: !!heal,
      hp: hp ? { value: Number(hp.value) || 0, max: Number(hp.effectiveMax ?? hp.max) || 0 } : null });
    if ( due.due ) out.push({ name, row, item, regain, heal });
  }
  return out;
}

/* --- the moment: a combatant's Initiative lands -------------------------------------------------------- */

listen("updateCombatant", "initiative-grants", (combatant, changes) => {
  if ( !("initiative" in (changes ?? {})) || !isActiveGM() ) return;
  const combat = combatant.parent;
  if ( !combat ) return;
  if ( changes.initiative === null ) { void rearm(combat, [combatant.id]); return; }
  void readFor(combat, combatant);
});

// A combatant added with its Initiative already rolled is read too.
listen("createCombatant", "initiative-grants", combatant => {
  if ( !isActiveGM() || (combatant.initiative === null) || (combatant.initiative === undefined) ) return;
  if ( combatant.parent ) void readFor(combatant.parent, combatant);
});

// ⚠ The tracker's "Reset Initiative" is ONE Combat update (the swap's note): re-arm the cleared.
listen("updateCombat", "initiative-grants", (combat, changes) => {
  if ( !("combatants" in (changes ?? {})) || !isActiveGM() ) return;
  const cleared = [...combat.combatants].filter(c => (c.initiative === null) || (c.initiative === undefined)).map(c => c.id);
  if ( cleared.length ) void rearm(combat, cleared);
});

async function rearm(combat, ids) {
  const read = combat.getFlag(MODULE_ID, INITIATIVE_READ_FLAG) ?? {};
  const drop = ids.filter(id => read[id]);
  if ( !drop.length ) return;
  await combat.update(Object.fromEntries(drop.map(id => [`flags.${MODULE_ID}.${INITIATIVE_READ_FLAG}.-=${id}`, null])))
    .catch(err => console.error(`${TITLE} | The Initiative grants could not re-arm.`, err));
}

/** In flight on this client: `combat|combatant` — the updates of one Roll All land in one tick. */
const reading = new Set();

async function readFor(combat, combatant) {
  const key = `${combat.id}|${combatant.id}`;
  if ( reading.has(key) ) return;
  const actor = combatant.actor;
  if ( !(actor instanceof Actor) ) return;
  if ( combat.getFlag(MODULE_ID, INITIATIVE_READ_FLAG)?.[combatant.id] ) return;
  reading.add(key);
  try {
    // Read the sheet NOW, post, then latch: the in-memory guard covers the posting, the flag every later roll.
    for ( const g of grantsFor(actor) ) await post(combat, combatant, actor, g);
    await combat.update({ [`flags.${MODULE_ID}.${INITIATIVE_READ_FLAG}.${combatant.id}`]: true });
  } catch(err) {
    console.error(`${TITLE} | The Initiative grants could not be read — regain them from the sheet.`, err);
  } finally {
    reading.delete(key);
  }
}

async function post(combat, combatant, actor, { name, row, item, regain, heal, give = null }) {
  const r = usesOf(regain);
  const formula = give ? give.formula : heal ? healFormulaOf(actor, heal) : null;
  if ( heal && !formula ) console.warn(`${TITLE} | ${name}: its heal could not be read off ${actor.name}'s sheet — roll it by hand.`);
  const window = row.ask ? decisionWindow() : 0;
  const flag = { status: row.ask ? "pending" : "resolved", answer: row.ask ? null : "auto", row: name, unit: row.unit ?? null,
    actorUuid: actor.uuid, actorName: combatant.name ?? actor.name, itemId: item.id, regainId: regain?.id ?? null,
    back: Math.min(r.spent, r.max), max: r.max, formula, combatId: combat.id, combatantId: combatant.id, ...statContext(actor.uuid),
    ...(give ? { give: true, reach: row.reach ?? 30, activityId: give.activity.id, poolId: give.pool.id, poolName: give.pool.name } : {}),
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}) };
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor, token: combatant.token }),
    content: bfCard({ img: item.img, eyebrow: "Initiative", tone: row.ask ? "pending" : "good", title: row.ask ? `${name} — use it now?` : name }),
    flags: { [MODULE_ID]: { [INITIATIVE_GRANT_FLAG]: flag } }
  });
}

/* --- the answer: the GM folds it, a player sends it ---------------------------------------------------- */

const settle = (current, answer, timedOut = false) => {
  if ( current.status !== "pending" ) return false;
  Object.assign(current, { status: "resolved", answer: (answer === "yes") ? "yes" : "no", answeredAt: Date.now(),
    ...(timedOut ? { timedOut: true } : {}) });
};

async function answerGrant(message, answer, { timedOut = false } = {}) {
  const flag = message.getFlag(MODULE_ID, INITIATIVE_GRANT_FLAG);
  if ( flag?.status !== "pending" ) return;
  if ( isActiveGM() ) {
    await queueFlagWrite(message, INITIATIVE_GRANT_FLAG, current => settle(current, answer, timedOut));
    return;
  }
  if ( !game.users.activeGM ) {
    ui.notifications?.warn(`${flag.row}: a GM must be on — use it from the sheet by hand.`);
    return;
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: resolveUuid(flag.actorUuid) }),
    content: "", whisper: game.users.filter(u => u.isGM).map(u => u.id),
    flags: { [MODULE_ID]: { initiativeGrantAnswer: { messageId: message.id, answer } } }
  });
}

registerRelay("initiativeGrantAnswer", {
  flagKey: INITIATIVE_GRANT_FLAG,
  targetOf: a => a.messageId,
  owns: () => isActiveGM(),
  cleanup: true,
  fold: (current, a) => settle(current, a.answer)
});

/** The GM lands a Yes (or a plain row): the uses back, the heal rolled and receipted, the feature's use spent. */
async function landGrant(message) {
  let claimed = false;
  await queueFlagWrite(message, INITIATIVE_GRANT_FLAG, current => {
    if ( (current.status !== "resolved") || (current.answer === "no") || current.applied || current.applying ) return false;
    current.applying = true;
    claimed = true;
  });
  if ( !claimed ) return;
  const flag = message.getFlag(MODULE_ID, INITIATIVE_GRANT_FLAG);
  const record = {};
  try {
    const actor = resolveUuid(flag.actorUuid);
    const item = actor?.items?.get(flag.itemId);
    if ( flag.give ) { Object.assign(record, await giveToAllies(flag, actor, item)); return; }
    const regain = actor?.items?.get(flag.regainId);
    if ( !(actor instanceof Actor) || !item || !regain ) throw new Error("the feature left the sheet");
    const own = usesOf(item);
    if ( (own.max > 0) && !(own.value > 0) ) { record.spentAlready = true; return; }
    const r = usesOf(regain);
    await regain.update({ "system.uses.spent": 0 });
    if ( own.max > 0 ) await item.update({ "system.uses.spent": own.spent + 1 });
    record.regained = Math.min(r.spent, r.max);
    record.max = r.max;
    if ( flag.formula ) {
      const roll = await new Roll(flag.formula).evaluate();
      record.healed = roll.total;
      await applyDamagesWithReceipt(message, [{ uuid: actor.uuid, name: actor.name }], [{ value: roll.total, type: "healing", properties: new Set() }],
        { note: flag.row });
    }
  } catch(err) {
    console.error(`${TITLE} | ${flag.row} failed part-way — check the sheet.`, err);
  } finally {
    await queueFlagWrite(message, INITIATIVE_GRANT_FLAG, current => { Object.assign(current, record, { applied: true, applying: false }); });
  }
}

registerResumable(INITIATIVE_GRANT_FLAG, {
  pending: flag => (flag?.status === "resolved") && (flag.answer !== "no") && !flag.applied && !flag.applying,
  drives: () => isActiveGM(),
  drive: landGrant
});

/* --- B4 — the gift to allies (Tandem Footwork): one roll, every ally's Initiative within reach ------------ */

/** The GM lands a `to: "allies"` Yes: the die rolled once, the pool's use spent, the rolled allies moved, the rest noted. */
async function giveToAllies(flag, actor, item) {
  if ( !(actor instanceof Actor) || !item ) throw new Error("the feature left the sheet");
  const pool = actor.items.get(flag.poolId) ?? item;
  if ( !(Number(pool.system?.uses?.value ?? 0) > 0) ) return { spentAlready: true };
  const combat = game.combats.get(flag.combatId);
  if ( !combat ) throw new Error("the combat is gone");
  const roll = await new Roll(String(flag.formula)).evaluate();
  const n = Math.max(0, Number(roll.total) || 0);
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${flag.row} — the die for allies within ${flag.reach ?? 30} ft` });
  await spendPoolUses(actor, pool, flag.row, 1, (pool === item) ? null : pool.name);
  const own = combat.combatants.get(flag.combatantId)?.token?.object ?? tokenForUuid(actor.uuid);
  const side = own?.document?.disposition;
  const given = [], due = [];
  for ( const c of combat.combatants ) {
    const token = c.token?.object ?? (c.actor ? tokenForUuid(c.actor.uuid) : null);
    if ( !token || !c.actor || (token.document?.disposition !== side) ) continue;
    const feet = (c.actor.uuid === actor.uuid) ? 0 : nearestFeet(own, token);
    if ( (feet === null) || (feet > (flag.reach ?? 30)) ) continue;
    if ( (c.initiative === null) || (c.initiative === undefined) ) { due.push(c.id); continue; }
    const from = Number(c.initiative);
    await c.update({ initiative: from + n }).catch(err => console.warn(`${TITLE} | ${flag.row}: could not move ${c.name}'s Initiative.`, err));
    given.push({ id: c.id, name: c.name, from, to: from + n });
  }
  if ( due.length ) {
    await combat.update(Object.fromEntries(due.map(id => [`flags.${MODULE_ID}.${BONUS_DUE_FLAG}.${id}`, { n, row: flag.row, from: actor.name }])))
      .catch(err => console.warn(`${TITLE} | ${flag.row}: the bonus due to late rollers could not be noted.`, err));
  }
  return { rolled: n, given, due };
}

// A combatant rolling AFTER the gift landed gets its bonus as its Initiative lands (the GM; the note is cleared).
listen("updateCombatant", "initiative-grants", (combatant, changes) => {
  try {
    if ( !("initiative" in (changes ?? {})) || !isActiveGM() ) return;
    const combat = combatant.parent;
    const note = combat?.getFlag(MODULE_ID, BONUS_DUE_FLAG)?.[combatant.id];
    if ( !note || (changes.initiative === null) || (changes.initiative === undefined) ) return;
    const from = Number(changes.initiative);
    void (async () => {
      await combat.update({ [`flags.${MODULE_ID}.${BONUS_DUE_FLAG}.-=${combatant.id}`]: null });
      await combatant.update({ initiative: from + Number(note.n) });
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: combatant.actor, token: combatant.token }),
        content: bfCard({ eyebrow: "Initiative", tone: "good", title: `${note.row} — +${note.n} Initiative for ${combatant.name} (${from} → ${from + Number(note.n)})`,
          subtitle: `${note.from}'s gift, rolled before ${combatant.name}'s Initiative` }) });
    })().catch(err => console.error(`${TITLE} | ${note.row}'s late bonus could not land — add it by hand.`, err));
  } catch(err) { console.error(`${TITLE} | The Initiative bonus due could not be read.`, err); }
});

/* --- the clock: No, on whoever drives the owner's moments --------------------------------------------- */

function armTimer(message) {
  const flag = message.getFlag(MODULE_ID, INITIATIVE_GRANT_FLAG);
  if ( (flag?.status !== "pending") || !flag.deadline || !drivesMomentFor(flag.actorUuid ?? null) ) return;
  armDeadline(timers, message.id, flag.deadline, async () => {
    const live = game.messages.get(message.id);
    if ( live?.getFlag(MODULE_ID, INITIATIVE_GRANT_FLAG)?.status === "pending" ) await answerGrant(live, "no", { timedOut: true });
  });
}

/* --- the popup and the card ------------------------------------------------------------------------- */

async function showGrantPopup(message) {
  const flag = message.getFlag(MODULE_ID, INITIATIVE_GRANT_FLAG);
  if ( flag?.status !== "pending" ) return;
  const actor = resolveUuid(flag.actorUuid);
  if ( !actor ) return;
  const row = INITIATIVE_GRANTS[flag.row] ?? null;
  await openMomentPopup(message, INITIATIVE_GRANT_FLAG, actor, {
    title: `${flag.row} — ${flag.actorName}`, icon: "fa-solid fa-bolt", width: 400,
    content: bfCard({ img: actor.items.get(flag.itemId)?.img ?? null, eyebrow: "Initiative", tone: "pending",
      title: initiativeGrantLine(flag), lines: [row?.rule ? foldedRuleHTML(row.rule) : ""] }) + holdBarHTML(flag, "to answer"),
    buttons: [
      { action: "yes", label: "Yes", default: true, callback: () => { void answerGrant(message, "yes"); } },
      { action: "no", label: "No", callback: () => { void answerGrant(message, "no"); } }
    ]
  });
}

listen("dnd5e.renderChatMessage", "initiative-grants", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, INITIATIVE_GRANT_FLAG);
    if ( !flag ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-initiative-grant-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-initiative-grant-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-bolt" data-tooltip="${esc(flag.row)}"></i> ${esc(initiativeGrantLine(flag))}`
      + ((flag.status === "pending") ? ` ${holdBarHTML(flag, "to answer")}` : "");
    if ( flag.status === "pending" ) {
      const actor = resolveUuid(flag.actorUuid);
      if ( canAnswerFor(actor) ) {
        const shown = popupKey(message.id, INITIATIVE_GRANT_FLAG);
        if ( !shownMoments.has(shown) ) { shownMoments.add(shown); void showGrantPopup(message); }
        div.appendChild(momentButton("Answer", () => { void showGrantPopup(message); }));
      }
      scheduleBarSync(div);
      armTimer(message);
    }
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The Initiative grant's line could not render.`, err); }
});

// An answer anywhere closes the popup everywhere (law 4); the clock stands down with it.
listen("updateChatMessage", "initiative-grants", message => {
  const flag = message.getFlag(MODULE_ID, INITIATIVE_GRANT_FLAG);
  if ( !flag ) return;
  if ( flag.status === "pending" ) { armTimer(message); return; }
  disarmDeadline(timers, message.id);
  const open = livePopups.get(popupKey(message.id, INITIATIVE_GRANT_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
});

listen("deleteChatMessage", "initiative-grants", message => { disarmDeadline(timers, message.id); });
