/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE DICE CHANGERS — one popup per damage roll, a row
 * per feature that changes the landed dice (the user, 2026-09-27; the shape drawn and liked
 * 2026-09-26, prototypes/dice-popup.html; RULINGS *The dice changers — one popup*). The pure half —
 * the order, the plan, the words — is decide/dice-changers.js; the arithmetic of a patched die is
 * decide/damage-dice.js.
 *
 * THE ROWS: Empowered Spell (a `pick` — Metamagic, the METAMAGIC table and its list), Savage
 * Attacker (a `set`) and Piercer (a `one`) — the DAMAGE_EITHER table and its list. One shell for
 * all three, where there were two copies (Empowered's in metamagic.js since 2026-09-09, Savage's in
 * damage-either.js since 2026-09-24): the birth flag, the popup, the clock, the recall, the durable
 * completion. A character holding two of them is asked ONCE per roll, both rows in one popup, and
 * one Apply runs them in the ruled order — pick, then set, then one (Piercer's die chosen off the
 * faces that stand after Savage's set).
 *
 * THE SEQUENCE (Savage's ruling, 2026-09-24, now every row's): the damage message is born with the
 * record DUE (preRollDamageV2, a birth flag), and auto-apply.js holds an attack's application while
 * it waits — so the dice land ONCE, with what stood. The question is asked only once the attack's
 * hold is off the roll: a roll born `attackHoldPending` waits for the hold's release write
 * (hold/continue.js), which reaches this file as an update; an attack the hold turned into a miss
 * resolves the record moot. A spell's damage with no attack behind it (Fireball) is not held by the
 * attack applier; damage already applied off it is moved by the difference at the completion
 * (auto-apply.js `moveAppliedDamage`, the §11 rule 4 obligation), as Empowered always did.
 *
 * THE PATCH: the old faces struck in the message's own roll data (decide/damage-dice.js), the rolls
 * rebuilt with their totals taken again (shared.js `rebuildRolls`), the message updated. ⚠ dnd5e
 * dispatches the damage hook TWICE per roll (measured 2026-09-09): an in-flight set keeps it single.
 */
import { MODULE_ID, TITLE, S, setting, statContext, queueFlagWrite, drivesMomentFor } from "./core.js";
import { lower, featureNamed, resolveUuid, dealtTypesOf } from "./lookup.js";
import { damageEitherEntries, listedNames } from "./settings.js";
import { hitTargets, turnChitStands, writeTurnChit, rebuildRolls, spendPoolUses } from "./shared.js";
import { DAMAGE_EITHER } from "./decide/registry.js";
import { weaponDiceOf, setFormula, setTotal, eitherOutcome, eitherPatch, eitherDue, eitherOdds,
  bestRerollDie, oneDieOdds, rerollFaces } from "./decide/damage-dice.js";
import { DICE_CHANGE_FLAG, orderRows, birthStatus, diceChipsOf, answerPlan, buttonState, applyLabel,
  rowOffer, popupTitle, stepLine, diceChangeLines, mergeRises } from "./decide/dice-changers.js";
import { empoweredReaches, empoweredOutcome } from "./decide/metamagic.js";
import { bfCard, esc, holdBarHTML, popupKey, tickRowsHTML, dieMeterHTML, spendPhrase } from "./decide/present.js";
import { eitherRise, rerollRise } from "./decide/dice-chips.js";
import { openMomentPopup, momentButton, armDeadline, disarmDeadline, livePopups, scheduleBarSync,
  dramaticVerdictPause, registerResumable, paintDieChip } from "./ui.js";
import { attackMessageForDamage } from "./auto-damage.js";
import { moveAppliedDamage } from "./auto-apply.js";
import { empoweredOffer, SORCERY_POINTS } from "./metamagic.js";
import { SURFACES } from "./surfaces.js";

const timers = new Map();
const offering = new Set();
const resolving = new Set();

/**
 * The DAMAGE_EITHER rows this attacker holds that fit THIS hit, in the table's order — every one,
 * not the first (BACKLOG's "one question per hit", closed 2026-09-27). A `weapon` row wants a
 * weapon; a `dealt` row a hit that deals its type (Piercer: Piercing).
 * @param {Actor} attacker
 * @param {{weapon?: boolean, dealt?: string[]}} [hit]
 */
function eitherRowsFor(attacker, hit = {}) {
  const listed = listedNames(damageEitherEntries());
  const out = [];
  for ( const [name, row] of Object.entries(DAMAGE_EITHER) ) {
    if ( !listed.has(lower(name)) ) continue;
    if ( row.weapon && (hit.weapon === false) ) continue;
    if ( row.dealt && !(hit.dealt ?? []).includes(row.dealt) ) continue;
    const feature = featureNamed(attacker, name);
    if ( feature ) out.push({ name, row, feature });
  }
  return out;
}

/** The damage types a built damage config deals — its rolls' own types, else the activity's. */
const dealtOf = (config, activity) => {
  const types = [...new Set((config?.rolls ?? []).flatMap(r => r?.options?.types ?? (r?.options?.type ? [r.options.type] : [])))];
  return types.length ? types : dealtTypesOf(activity);
};

/** How many of the message's rolls are the activity's own (auto-damage.js stamps it); one when unstamped. */
const weaponRollsOf = message => {
  const n = Number(message.getFlag(MODULE_ID, "weaponRolls"));
  return Number.isFinite(n) && (n > 0) ? n : 1;
};

/** The whole roll's total, every part. */
const rollsTotal = rolls => (rolls ?? []).reduce((n, r) => n + (Number(r.total) || 0), 0);

/** A row's feature on the actor's sheet — its image and its uuid. */
const featureOf = (actor, row) => featureNamed(actor, row.feature) ?? actor?.items?.find(i => i.name === row.feature) ?? null;

/* --- the birth flag: every row that fits, due or spent this turn ------------------------------- */

Hooks.on("dnd5e.preRollDamageV2", (config, _dialog, message) => {
  try {
    const activity = config?.subject;
    const actor = activity?.actor;
    if ( !actor ) return;
    const rows = [];
    let attackId = null;
    // Empowered Spell — "when you roll damage for a spell": damage, never a spell's healing.
    if ( (activity.item?.type === "spell")
      && empoweredReaches({ activityType: activity.type, rollTypes: (config?.rolls ?? []).map(r => r?.options?.type) }) ) {
      const offer = empoweredOffer(actor);
      if ( offer ) rows.push({ key: "empowered", feature: "Empowered Spell", kind: "pick", status: "due", ...offer });
    }
    // Savage Attacker and Piercer — an attack's hit.
    const attackMessage = (activity.type === "attack") ? attackMessageForDamage(config, message) : null;
    if ( attackMessage ) {
      attackId = attackMessage.id;
      const weapon = activity.item?.type === "weapon";
      for ( const found of eitherRowsFor(actor, { weapon, dealt: dealtOf(config, activity) }) ) {
        // a row that does not ask for a weapon (Piercer) is due on any attack that fits it
        const status = eitherDue({ listed: true, owned: true, weapon: weapon || !found.row.weapon,
          chitStands: turnChitStands(actor, "rider", found.row.key) });
        if ( status ) rows.push({ key: found.row.key, feature: found.name, kind: found.row.one ? "one" : "set", status });
      }
    }
    const status = birthStatus(rows);
    if ( !status ) return;
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.${DICE_CHANGE_FLAG}`, {
      status, actorUuid: actor.uuid, attackId, rows: orderRows(rows), ...statContext(actor.uuid)
    });
  } catch(err) {
    console.error(`${TITLE} | The dice changers could not be offered — change the dice by hand.`, err);
  }
});

/* --- the promotion: due → pending, once the hold is off the roll -------------------------------- */

// The roller's client, as the dice land (twice — the in-flight set keeps it single).
Hooks.on("dnd5e.rollDamageV2", rolls => {
  const message = rolls?.[0]?.parent;
  if ( message instanceof ChatMessage ) void promote(message);
});

// The hold's release (hold/continue.js writes `attackHoldPending: false` on the roll), on the client
// that rolled it; a settled record closes its popup (law 4) and stands its buzzer down, and a pending
// one re-arms here on whichever client drives the moment.
Hooks.on("updateChatMessage", message => {
  const flag = message.getFlag(MODULE_ID, DICE_CHANGE_FLAG);
  if ( !flag ) return;
  if ( (flag.status === "due") && message.isAuthor ) void promote(message);
  if ( flag.status === "pending" ) { armTimer(message); return; }
  disarmDeadline(timers, message.id);
  const open = livePopups.get(popupKey(message.id, DICE_CHANGE_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
});

async function promote(message) {
  const flag = message.getFlag(MODULE_ID, DICE_CHANGE_FLAG);
  if ( (flag?.status !== "due") || offering.has(message.id) ) return;
  // The hold first: its release write brings this back (the update hook above).
  if ( message.getFlag(MODULE_ID, "attackHoldPending") === true ) return;
  offering.add(message.id);
  try {
    const actor = resolveUuid(flag.actorUuid);
    const attackMessage = flag.attackId ? game.messages.get(flag.attackId) : null;
    // A hold that turned the hit into a miss leaves nothing to change, and spends nothing.
    const missed = !!flag.attackId && (!attackMessage || !hitTargets(attackMessage).length);
    const data = (message.rolls ?? []).map(r => r.toJSON());
    const wdice = weaponDiceOf(data, weaponRollsOf(message));
    const best = bestRerollDie(data);
    const chips = diceChipsOf(data);
    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    await queueFlagWrite(message, DICE_CHANGE_FLAG, current => {
      if ( current.status !== "due" ) return false;
      for ( const row of current.rows ?? [] ) {
        if ( row.status !== "due" ) continue;
        if ( missed ) { row.status = "moot"; continue; }
        if ( row.kind === "set" ) {
          if ( !wdice.length ) { row.status = "moot"; continue; }
          row.formula = setFormula(wdice);
          row.first = setTotal(wdice);
          row.odds = eitherOdds(wdice, row.first);
        } else if ( row.kind === "one" ) {
          if ( !best ) { row.status = "moot"; continue; }
          row.faces = best.faces;
          row.first = best.value;
          row.odds = oneDieOdds(best.faces, best.value);
        } else if ( row.kind === "pick" ) {
          // the point is read again as the dice land: one spent since the birth takes the row away
          const pool = actor?.items?.get(row.poolId) ?? null;
          if ( !chips.length || !pool || ((pool.system?.uses?.value ?? 0) < (Number(row.cost) || 1)) ) { row.status = "moot"; continue; }
        }
        row.status = "pending";
      }
      current.dice = chips;
      current.total = rollsTotal(message.rolls);
      if ( !current.rows.some(r => r.status === "pending") ) {
        current.status = current.rows.every(r => r.status === "spent") ? "spent" : "moot";
        return;
      }
      current.status = "pending";
      if ( window ) { current.window = window; current.deadline = Date.now() + (window * 1000); }
    });
    if ( message.getFlag(MODULE_ID, DICE_CHANGE_FLAG)?.status !== "pending" ) return;
    armTimer(message);
    // The table sees the dice land before the question about them opens (the verdict pause's rule).
    await dramaticVerdictPause(message);
    await showPopup(message);
  } finally {
    offering.delete(message.id);
  }
}

/**
 * The buzzer, on whoever drives the actor's moments (core.js `drivesMomentFor`: the active GM, and
 * with no GM the actor's own player) — an attack's damage waits on this answer, so a table with no
 * GM must still have a clock that keeps the roll.
 */
function armTimer(message) {
  const flag = message.getFlag(MODULE_ID, DICE_CHANGE_FLAG);
  if ( (flag?.status !== "pending") || !flag.deadline || !drivesMomentFor(flag.actorUuid ?? null) ) return;
  armDeadline(timers, message.id, flag.deadline, async () => {
    const live = game.messages.get(message.id);
    if ( live?.getFlag(MODULE_ID, DICE_CHANGE_FLAG)?.status === "pending" ) await keep(live, { timedOut: true });
  });
}

/* --- the popup ---------------------------------------------------------------------------------- */

/** The ticked rows and the picked chips in a popup's form, the chips in the order they were ticked. */
const ticksIn = form => [...(form?.querySelectorAll?.('input[name="bf-dice"]:checked') ?? [])].map(b => b.value);
const picksIn = form => [...(form?.querySelectorAll?.('[data-bf-die][data-picked="1"]') ?? [])]
  .sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order)).map(b => b.dataset.bfDie);

async function showPopup(message) {
  const flag = message.getFlag(MODULE_ID, DICE_CHANGE_FLAG);
  if ( flag?.status !== "pending" ) return;
  const actor = resolveUuid(flag.actorUuid);
  if ( !actor ) return;
  const asking = (flag.rows ?? []).filter(r => r.status === "pending");
  if ( !asking.length ) return;
  const lead = asking[0];
  const pickRow = asking.find(r => r.kind === "pick") ?? null;
  const meterRow = asking.find(r => (r.kind !== "pick") && r.odds) ?? null;
  const weapon = flag.attackId ? (game.messages.get(flag.attackId)?.getAssociatedActivity?.()?.item ?? null) : null;
  const formula = (message.rolls ?? []).map(r => r.formula).join(" + ");
  const pool = pickRow ? (actor.items?.get(pickRow.poolId) ?? null) : null;
  const subtitle = [`${weapon?.name ?? "the roll"} · ${formula} → ${flag.total}`,
    pool ? `${SORCERY_POINTS}: ${pool.system?.uses?.value ?? "?"} of ${pool.system?.uses?.max ?? "?"}` : null].filter(Boolean).join(" · ");
  // The chips: every die the roll shows — pickable when a pick row asks (Empowered's), else the
  // roll laid out for the eye. Eight to a row (user, 2026-09-09).
  const chips = (flag.dice ?? []).map(d => `<button type="button" data-bf-die="${esc(d.key)}" data-picked="0" ${pickRow ? "" : "disabled"}
      data-tooltip="d${d.faces}${(d.rolled !== undefined) ? ` · rolled ${d.rolled}, counts ${d.result}` : ""}"
      style="width:2.2rem;height:2.2rem;margin:0;padding:0;font-weight:bold;${d.result <= 2 ? "color:#b4463c;" : ""}${pickRow ? "" : "opacity:0.75;cursor:default;"}">${d.result}</button>`).join("");
  const dialog = await openMomentPopup(message, DICE_CHANGE_FLAG, actor, {
    title: `${asking.map(r => r.feature).join(" · ")} — ${actor.name}`,
    icon: pickRow && (asking.length === 1) ? "fa-solid fa-wand-sparkles" : "fa-solid fa-dice", width: 460,
    content: bfCard({
      img: featureOf(actor, lead)?.img ?? weapon?.img ?? null,
      eyebrow: (asking.length === 1) ? (pickRow ? "Metamagic — Empowered Spell" : `Damage — ${lead.feature}`) : "Damage — the dice",
      tone: "pending",
      title: popupTitle(asking, flag.total),
      subtitle
    }) + holdBarHTML(flag, "to answer")
      // THE HINT (option D, ruled 2026-09-25 off prototypes/savage-hint.html): the die meter in the
      // header for the roll-again row; its tick starts where the meter leans.
      + (meterRow ? dieMeterHTML({ value: meterRow.first, ...meterRow.odds }) : "")
      + (chips ? `<div data-bf-dice-chips data-cap="${pickRow?.cap ?? 0}" style="margin:0.4rem 0;display:grid;grid-template-columns:repeat(8, 2.2rem);gap:0.3rem;justify-content:start;">${chips}</div>` : "")
      + `<span data-bf-dice-for="${esc(message.id)}" hidden></span>`
      + tickRowsHTML({ name: "bf-dice", rows: asking.map(r => ({ key: r.key, name: r.feature, ...rowOffer(r), rule: r.rule ?? DAMAGE_EITHER[r.feature]?.rule ?? null })) }),
    buttons: [
      // The window goes at the click (Empowered's lesson, 2026-09-10): the work is fired, not awaited,
      // and the ticks are read while the form is still in the DOM.
      { action: "apply", label: applyLabel(asking), default: true,
        callback: (_event, button) => { void resolve(message, { ticked: ticksIn(button.form), picks: picksIn(button.form) }); } },
      { action: "keep", label: "Keep the roll", callback: () => { void keep(message); } }
    ]
  });
  const form = dialog?.element?.querySelector?.("form") ?? dialog?.element ?? null;
  if ( !form ) return;
  // Where each tick starts: a roll-again row where its hint leans (under the average: ticked); the
  // pick row follows its chips — a point is spent only on dice the caster chose.
  for ( const row of asking ) {
    const box = form.querySelector(`input[name="bf-dice"][value="${row.key}"]`);
    if ( box ) box.checked = (row.kind !== "pick") && (row.odds?.low !== false);
  }
  form.addEventListener("change", ev => {
    const box = ev.target?.closest?.('input[name="bf-dice"]');
    if ( !box ) return;
    // unticking the pick row lets its chips go
    if ( !box.checked && (asking.find(r => r.key === box.value)?.kind === "pick") ) {
      for ( const chip of form.querySelectorAll('[data-bf-die][data-picked="1"]') ) paintDieChip(chip, false);
    }
    syncButtons(form);
  });
  syncButtons(form);
}

/** The buttons follow the ticks and the chips (decide/dice-changers.js `buttonState`). */
function syncButtons(form) {
  const id = form?.querySelector?.("[data-bf-dice-for]")?.dataset?.bfDiceFor ?? "";
  const flag = game.messages.get(id)?.getFlag(MODULE_ID, DICE_CHANGE_FLAG) ?? null;
  const apply = form?.querySelector?.('button[data-action="apply"]');
  const keepButton = form?.querySelector?.('button[data-action="keep"]');
  if ( !apply || !keepButton ) return;
  const rows = flag?.rows ?? [];
  const state = rows.length ? buttonState({ rows, ticked: ticksIn(form), picks: picksIn(form), dice: flag.dice ?? [] })
    : { apply: !!ticksIn(form).length, keep: !ticksIn(form).length };
  apply.disabled = !state.apply;
  keepButton.disabled = !state.keep;
}

// The chips toggle by delegation — one listener on the document serves every open popup. The cap is
// enforced as the picks are made; a pick ticks the pick row, the last one let go unticks it.
Hooks.once("ready", () => document.addEventListener("click", ev => {
  const chip = ev.target?.closest?.("[data-bf-die]");
  const box = chip?.closest?.("[data-bf-dice-chips]");
  if ( !chip || !box || chip.disabled ) return;
  ev.preventDefault();
  const cap = Number(box.dataset.cap) || 0;
  if ( !cap ) return;
  const picked = [...box.querySelectorAll('[data-picked="1"]')];
  if ( chip.dataset.picked === "1" ) paintDieChip(chip, false);
  else if ( picked.length < cap ) { chip.dataset.order = String(Date.now()); paintDieChip(chip, true); }
  const form = box.closest("form") ?? box.parentElement;
  const tick = [...(form?.querySelectorAll?.('input[name="bf-dice"]') ?? [])]
    .find(b => b.closest("[data-bf-tick-row]")?.dataset?.bfTickRow === "empowered");
  if ( tick ) tick.checked = !!box.querySelector('[data-picked="1"]');
  syncButtons(form);
}));

async function keep(message, { timedOut = false } = {}) {
  await queueFlagWrite(message, DICE_CHANGE_FLAG, current => {
    if ( current.status !== "pending" ) return false;
    current.status = "kept";
    current.answeredAt = Date.now();
    for ( const row of current.rows ?? [] ) if ( row.status === "pending" ) row.status = "kept";
    if ( timedOut ) current.timedOut = true;
  });
}

/* --- the answer: every ticked row, in the ruled order ------------------------------------------ */

/** A fresh roll's counted faces, summed. */
const freshSum = roll => roll.dice.reduce((n, d) => n + d.results.filter(r => (r.active !== false) && !r.discarded)
  .reduce((a, r) => a + (Number(r.result) || 0), 0), 0);

async function resolve(message, { ticked, picks }) {
  if ( resolving.has(message.id) ) return;
  resolving.add(message.id);
  let record = null;   // Empowered's spend, once it has happened — the failure path must not lose it
  try {
    const flag = message.getFlag(MODULE_ID, DICE_CHANGE_FLAG);
    if ( flag?.status !== "pending" ) return;
    const plan = answerPlan({ rows: flag.rows, ticked, picks, dice: flag.dice ?? [] });
    if ( !plan.length ) { await keep(message); return; }
    const actor = resolveUuid(flag.actorUuid);
    if ( !actor ) return;
    // ANSWERED IS NOT PENDING (the d20 folds' rule): the status leaves "pending" before the dice, so
    // the buzzer can no longer keep a roll the player chose to change, and the popup closes.
    await queueFlagWrite(message, DICE_CHANGE_FLAG, current => {
      if ( current.status !== "pending" ) return false;
      current.status = "answering";
      current.answeredAt = Date.now();
      current.answered = plan.map(s => s.row.key);
    });
    if ( message.getFlag(MODULE_ID, DICE_CHANGE_FLAG)?.status !== "answering" ) return;   // somebody else got there
    let data = (message.rolls ?? []).map(r => r.toJSON());
    let running = Number(flag.total) || 0;
    const fresh = [];
    const rises = [];
    const outcomes = {};
    for ( const step of plan ) {
      const row = step.row;
      if ( row.kind === "pick" ) {
        const live = (step.picks ?? []).filter(d => data[d.roll]?.terms?.[d.term]?.results?.[d.index]);
        if ( !live.length ) continue;
        const pool = actor.items?.get(row.poolId) ?? null;
        if ( !pool ) continue;
        record = await spendPoolUses(actor, pool, "Empowered Spell", Number(row.cost) || 1, SORCERY_POINTS);
        // THE DICE ARE ONE ROLL, AND THEY RIDE THE ANNOUNCE CARD (user, 2026-09-10: Dice So Nice rolls again).
        const roll = await new Roll(live.map(d => `1d${d.faces}`).join(" + ")).evaluate();
        const faces = roll.dice.map(die => die.results.find(r => r.active !== false)?.result ?? die.total);
        const patched = rerollFaces(data, live, faces);
        data = patched.data;
        const out = empoweredOutcome({ oldTotal: running, picks: patched.done });
        outcomes[row.key] = { status: "used", picks: patched.done, delta: out.delta, before: running, after: out.newTotal };
        running = out.newTotal;
        fresh.push(roll);
        rises.push(rerollRise({ done: patched.done, on: actor.uuid }));
      } else if ( row.kind === "set" ) {
        // THE SECOND SET, ONE ROLL — the weapon's die terms, term for term, off the faces standing now.
        const dice = weaponDiceOf(data, weaponRollsOf(message));
        if ( !dice.length ) continue;
        const formula = setFormula(dice);
        const roll = await new Roll(formula).evaluate();
        const first = setTotal(dice);
        const second = freshSum(roll);
        const outcome = eitherOutcome({ first, second });
        data = eitherPatch(data, dice, roll.dice.map(d => d.results.map(r => ({ ...r }))), outcome.stands === "second");
        outcomes[row.key] = { status: "used", formula, first, second, stands: outcome.stands, delta: outcome.delta,
          before: running, after: running + outcome.delta };
        running += outcome.delta;
        fresh.push(roll);
        rises.push(eitherRise({ first, second, stands: outcome.stands, on: actor.uuid }));
      } else {
        // ONE die (Piercer): the die with the most to gain among the faces standing NOW (the ruled order).
        const pick = bestRerollDie(data);
        if ( !pick ) continue;
        const roll = await new Roll(`1d${pick.faces}`).evaluate();
        const patched = rerollFaces(data, [pick], [freshSum(roll)]);
        const done = patched.done[0];
        if ( !done ) continue;
        data = patched.data;
        const delta = done.new - done.old;
        outcomes[row.key] = { status: "used", faces: pick.faces, first: done.old, second: done.new, stands: "second", delta,
          before: running, after: running + delta };
        running += delta;
        fresh.push(roll);
        rises.push({ on: actor.uuid, chips: [{ was: String(done.old), label: String(done.new), up: done.new >= done.old }] });
      }
    }
    if ( !Object.keys(outcomes).length ) {
      await queueFlagWrite(message, DICE_CHANGE_FLAG, current => {
        if ( current.status !== "answering" ) return false;
        current.status = "pending";
        delete current.answered;
      });
      return;
    }
    const rebuilt = rebuildRolls(data);
    const total = rollsTotal(rebuilt);
    const delta = total - (Number(flag.total) || 0);
    const ran = plan.map(s => s.row).filter(r => outcomes[r.key]);
    const lines = ran.map(r => esc(stepLine({ ...r, ...outcomes[r.key] })));
    if ( record ) lines.push(esc(spendPhrase([record], "Sorcery Point")));
    const rise = mergeRises(rises);
    const announce = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: fresh,
      content: bfCard({ img: featureOf(actor, ran[0])?.img ?? null,
        eyebrow: (ran.length === 1) && (ran[0].kind === "pick") ? "Metamagic — Empowered Spell" : `Damage — ${ran.map(r => r.feature).join(", then ")}`,
        tone: delta > 0 ? "good" : "neutral",
        title: `${ran.map(r => r.feature).join(", then ")} — ${flag.total} → ${total}`,
        subtitle: (delta === 0) ? "The total stands." : `The damage is ${total} now — the new rolls stand.`,
        lines }),
      // the changed dice on the canvas, over the actor, in the order they ran (the dice that rise)
      flags: { [MODULE_ID]: { respondsTo: message.id, ...(rise ? { diceRise: rise } : {}) } }
    });
    // THE DURABLE INTENT, BEFORE THE PAUSE (Empowered's 2026-09-10 review): everything the completion
    // needs is written first, so the driver's resume can finish it if this client dies.
    await queueFlagWrite(message, DICE_CHANGE_FLAG, current => {
      if ( current.status !== "answering" ) return false;
      current.pending = { rolls: rebuilt.map(r => JSON.stringify(r.toJSON())), outcomes, total, delta, at: Date.now() };
    });
    if ( record ) await message.setFlag(MODULE_ID, "poolSpend", record);
    // Once per turn: a chit per roll-again row, on the attacker, for the turn in progress (none out of combat).
    for ( const row of ran.filter(r => r.kind !== "pick") ) {
      const feature = featureOf(actor, row);
      void writeTurnChit(actor, "rider", { name: `${row.feature} — used this turn`, img: feature?.img ?? null,
        description: `${row.feature} changed an attack's damage dice this turn. Once per turn; this chit ends with the turn.`,
        origin: feature?.uuid ?? null, riderKey: row.key })
        .catch(err => console.warn(`${TITLE} | Could not write the ${row.feature} chit.`, err));
    }
    if ( announce ) await dramaticVerdictPause(announce);
    await complete(message);
  } catch(err) {
    console.error(`${TITLE} | The dice changers failed to roll — change the dice by hand.`, err);
    // Never strand "answering": a written intent completes; a point spent with nothing written ends
    // the moment used with the spend on record (the dice are the caster's to reroll by hand); with
    // nothing spent the offer comes back.
    const current = message.getFlag(MODULE_ID, DICE_CHANGE_FLAG);
    if ( current?.pending ) await complete(message).catch(() => {});
    else {
      await queueFlagWrite(message, DICE_CHANGE_FLAG, live => {
        if ( live.status !== "answering" ) return false;
        live.status = record ? "used" : "pending";
        if ( record ) live.failed = true;
        delete live.answered;
      }).catch(() => {});
      if ( record && !message.getFlag(MODULE_ID, "poolSpend") ) await message.setFlag(MODULE_ID, "poolSpend", record).catch(() => {});
    }
  } finally {
    resolving.delete(message.id);
  }
}

/**
 * THE COMPLETION — the one step between "answering" and "used": the patched rolls onto the message,
 * each row's outcome onto its row (a row not ticked is kept), the settling write auto-apply's claim
 * waits on, and damage already applied moved by the difference. Idempotent by status.
 */
async function complete(message) {
  const flag = message.getFlag(MODULE_ID, DICE_CHANGE_FLAG);
  if ( (flag?.status !== "answering") || !flag.pending ) return;
  const { rolls, outcomes, total, delta } = flag.pending;
  const rows = (flag.rows ?? []).map(r => outcomes?.[r.key] ? { ...r, ...outcomes[r.key] }
    : ((r.status === "pending") ? { ...r, status: "kept" } : r));
  const { pending: _done, answered: _keys, ...rest } = flag;
  void _done; void _keys;
  await message.update({
    rolls,
    flags: { [MODULE_ID]: { [DICE_CHANGE_FLAG]: { ...rest, rows, status: "used", total, delta, "-=pending": null, "-=answered": null } } }
  });
  const used = rows.filter(r => outcomes?.[r.key]).map(r => r.feature).join(", ");
  await moveAppliedDamage(message, { delta, feature: used });
}

/** Past the longest the pause can be (six seconds of dice, up to ten of dramatic beat), with slack. */
const RESUME_MS = 20_000;
registerResumable(DICE_CHANGE_FLAG, {
  // A completion the clicking client never took, and a DUE the roller never promoted (its client
  // gone before the hold released): the driver finishes the one and asks the other.
  pending: (flag, message) => ((flag?.status === "answering") && !!flag.pending && ((Date.now() - (flag.pending.at ?? 0)) > RESUME_MS))
    || ((flag?.status === "due") && (message.getFlag(MODULE_ID, "attackHoldPending") !== true)
      && ((Date.now() - (message.timestamp ?? 0)) > RESUME_MS)),
  drives: flag => drivesMomentFor(flag?.actorUuid ?? null),
  drive: message => (message.getFlag(MODULE_ID, DICE_CHANGE_FLAG)?.status === "due") ? promote(message) : complete(message)
});

/* --- the card (R5): what happened, and the recall while it asks -------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, DICE_CHANGE_FLAG);
    const legacy = !flag ? legacyLines(message) : null;
    if ( !flag && !legacy ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-dice-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-dice-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = (legacy ?? diceChangeLines(flag)).map(line => `<div><i class="fa-solid fa-dice" data-tooltip="The dice changed"></i> ${esc(line)}</div>`).join("")
      + ((flag?.status === "pending") ? ` ${holdBarHTML(flag, "to answer")}` : "");
    if ( flag?.status === "pending" ) {
      const actor = resolveUuid(flag.actorUuid);
      if ( actor?.isOwner ) div.appendChild(momentButton("Answer", () => { void showPopup(message); }));
      scheduleBarSync(div);
      armTimer(message);
    }
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The dice line could not render.`, err); }
});

/**
 * A card from before the one popup (v2.4.0 and earlier: Savage's `either`, Empowered's `empowered`)
 * still says what happened on a reload — read-only; nothing writes those keys any more.
 */
function legacyLines(message) {
  const either = message.getFlag(MODULE_ID, "either");
  const empowered = message.getFlag(MODULE_ID, "empowered");
  const lines = [];
  if ( either?.status ) lines.push(...diceChangeLines({ status: either.status, timedOut: either.timedOut,
    rows: [{ ...either, key: either.key ?? "either", feature: either.feature ?? "Savage Attacker", kind: either.one ? "one" : "set", after: either.total }] }));
  if ( empowered?.status === "used" ) {
    lines.push(`Empowered Spell — ${empoweredOutcome({ oldTotal: empowered.oldTotal, picks: empowered.picks ?? [] }).line}`);
  } else if ( empowered?.status ) lines.push(`Empowered Spell — ${empowered.status === "kept" ? "kept" : empowered.status}`);
  return lines.length ? lines : null;
}
