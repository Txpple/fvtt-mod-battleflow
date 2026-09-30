/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE TURN-START GRANT (TURN_GRANTS) — a landed effect whose
 * text pays the bearer at the start of each of its turns what the pack rolls once, at the cast
 * (Heroism's Temporary Hit Points): the origin item's activity is rolled again on the caster's numbers
 * and landed on the bearer with a receipt, no choice (R1). The precedent is the emanation's turn-start heal.
 * A `match: "feature"` row (Regeneration, the GM's side) is the bearer's OWN trait: its heal rolled on the bearer's
 * numbers, while it has at least 1 Hit Point, unless a damage type its own copy names was dealt to it since
 * its last turn started (the receipts) — then a card says why nothing is paid.
 * A `deals` row (the GM's side) is a DAMAGE: the grappled creature's own turn start or end pays the grappler's
 * "Damage: Grappled" rolled on the grappler's numbers (Constricting Vine, the swarm); a feature row's
 * `deals: "grappled"` pays the bearer's damage to what it grapples at its own turn start (Barbed Hide).
 * The PHB classes (A6): a feature row `on: "use"` pays as its bearer uses the named item (Vitality Surge at the
 * Rage); `while: "raging"` pays only while the Rage stands; `to: "ally"` rolls the amount and GIVES it to one
 * creature within reach — the owner's pick, the rest song's popup (Life-Giving Force).
 */
import { MODULE_ID, TITLE, drivesMomentFor, statContext, isActiveGM, queueFlagWrite, canAnswerFor, decisionWindow } from "./core.js";
import { activityNamed, activityOfType, cardActivity, featureNamed, lower, resolveUuid } from "./lookup.js";
import { chitStampOf, effectSourceOf, poolOf } from "./shared.js";
import { endOptionsOf } from "./decide/turn-grants.js";
import { holdBarHTML, popupKey, esc } from "./decide/present.js";
import { livePopups, openMomentPopup, momentButton, shownMoments, scheduleBarSync, armDeadline, disarmDeadline, registerRelay, registerResumable } from "./ui.js";
import { SURFACES } from "./surfaces.js";
import { CARD, isCard, targetsOf } from "./decide/card.js";
import { extendedThisTurn } from "./decide/turn-grants.js";
import { grappledBy, tokenForUuid } from "./geometry.js";
import { TURN_GRANTS, answers, turnGrantEntries, listedNames } from "./decide/registry.js";
import { grantRowFor, grantDue, grantTitle, featureGrantRows, blockingTypes, damagedSince } from "./decide/turn-grants.js";
import { riderPartFormula } from "./decide/clock.js";
import { bfCard, ruleLine } from "./decide/present.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { askHandOut } from "./rest-grants.js";
import { listen } from "./dispatch.js";

const GRANT_FLAG = "turnGrant";

/** The turns this client has paid: `combat|round|turn|effect`. The log is the durable copy. */
const paid = new Set();

/** The item a landed effect came from: shared.js's walk (the activity first — a tray-applied copy's `item`
 * names the pack, NOTES §2). */
const originItemOf = effect => effectSourceOf(effect)?.item ?? null;

const settledAt = place => game.messages.contents.some(m => m.getFlag(MODULE_ID, GRANT_FLAG)?.place === place);

/** The bearer's listed effects at one of its moments (`on`): each row's grant or damage, once per turn. */
function payEffects(actor, combat, { on, round, turn, why }) {
  const listed = listedNames(turnGrantEntries());
  for ( const effect of actor.effects ) {
    if ( effect.disabled ) continue;
    const item = originItemOf(effect);
    const row = grantRowFor({ table: TURN_GRANTS, item, effectName: effect.name, listed, answers, on });
    if ( !row ) continue;
    const place = `${combat.id}|${round}|${turn}|${on === "turnEnd" ? "end|" : ""}${effect.uuid}`;
    const due = grantDue({ paid, place: settledAt(place) ? null : place });
    if ( !due.due ) continue;
    if ( row.unlessFeature && featureNamed(actor, row.unlessFeature) ) continue;   // Persistent Rage: nothing to extend
    paid.add(place);
    if ( row.remind ) { void remindExtend({ effect, row, item, actor, place, combat, round, turn }); continue; }
    void pay({ effect, row, item, actor, place, why: why ?? due.why, on });
  }
}

/** When each combatant's turn began on THIS client (`combat|round|turn` → ms): the turn's own cards are those after. */
const turnBegan = new Map();
listen("updateCombat", "turn-grants", (combat, changes) => {
  if ( (!("turn" in changes) && !("round" in changes)) || !combat.started ) return;
  turnBegan.set(`${combat.id}|${combat.round}|${combat.turn}`, Date.now());
});

/**
 * A `remind: "extend"` row (Rage) at the bearer's turn END: nothing paid, nothing ended — a card when the turn
 * shows no attack roll at an enemy and no save forced on one. The turn the effect began is its own extension;
 * a turn this client never saw begin is left alone (never a reminder on a guess).
 */
async function remindExtend({ effect, row, item, actor, place, combat, round, turn }) {
  try {
    if ( chitStampOf(effect) === `${combat.id}:${round}:${turn}` ) return;
    const began = turnBegan.get(`${combat.id}|${round}|${turn}`);
    if ( !began ) return;
    const mine = game.messages.contents.filter(m => ((m.timestamp ?? 0) >= began) && (m.getAssociatedActor?.()?.uuid === actor.uuid));
    const side = actor.getActiveTokens?.()?.[0]?.document?.disposition ?? 0;
    const cards = mine.map(m => {
      const activity = cardActivity(m);
      const kind = isCard(m, CARD.attack) ? "attack" : ((activity?.type === "save") && !isCard(m, CARD.damage)) ? "save" : null;
      return kind ? { kind, sides: targetsOf(m).map(t => fromUuidSync(t.uuid)?.getActiveTokens?.()?.[0]?.document?.disposition ?? 0) } : null;
    }).filter(Boolean);
    const verdict = extendedThisTurn({ cards, side });
    if ( verdict.extended ) return;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: bfCard({ img: item.img ?? null, eyebrow: "Turn end", tone: "neutral",
        title: `${row.key} — it ends now unless you extended it`,
        subtitle: `${actor.name} made ${verdict.why} this turn — ${row.says}; nothing is removed`,
        lines: [ruleLine(row.rule)] }),
      flags: { [MODULE_ID]: { [GRANT_FLAG]: { ...statContext(actor.uuid), key: row.key, place, effectUuid: effect.uuid,
        actorUuid: actor.uuid, remind: row.remind, why: verdict.why } } }
    });
  } catch(err) {
    console.error(`${TITLE} | ${row?.key ?? "The"} reminder could not post.`, err);
  }
}

// The turn moved: the current combatant's listed effects and own traits pay at its turn START, and the
// combatant whose turn just ENDED pays its `on: "turnEnd"` rows — each on the bearer's driver, once per turn.
listen("updateCombat", "turn-grants", (combat, changes, options) => {
  try {
    if ( !("turn" in changes) && !("round" in changes) ) return;
    if ( !combat.started || (options?.direction === -1) ) return;
    const prev = combat.previous ?? null;
    const ended = prev?.combatantId ? (combat.combatants.get(prev.combatantId)?.actor ?? null) : null;
    if ( (ended instanceof Actor) && drivesMomentFor(ended.uuid) ) {
      payEffects(ended, combat, { on: "turnEnd", round: prev.round, turn: prev.turn, why: "the end of its turn" });
      // B4 — the bearer's OWN turn-end rows (Self-Restoration): a condition's end offered as its turn ends.
      const listedEnd = listedNames(turnGrantEntries());
      for ( const { key, row, item } of featureGrantRows({ table: TURN_GRANTS, features: ended.items.filter(i => i.type === "feat"), listed: listedEnd, answers, on: "turnEnd" }) ) {
        if ( row.grant !== "end" ) continue;
        const place = `${combat.id}|${prev.round}|${prev.turn}|end|${item.uuid}|${key}`;
        if ( !grantDue({ paid, place: settledAt(place) ? null : place }).due ) continue;
        paid.add(place);
        void offerEnd({ row: { key, ...row }, item, actor: ended, bearer: ended, place, on: "turnEnd", why: "the end of its turn" });
      }
    }
    const actor = combat.combatant?.actor ?? null;
    if ( !(actor instanceof Actor) || !drivesMomentFor(actor.uuid) ) return;
    payEffects(actor, combat, { on: "turnStart", round: combat.round, turn: combat.turn, why: null });
    // The bearer's OWN traits (Regeneration, Barbed Hide): no effect to find, the sheet is the row.
    const listed = listedNames(turnGrantEntries());
    for ( const { key, row, item } of featureGrantRows({ table: TURN_GRANTS, features: actor.items.filter(i => i.type === "feat"), listed, answers, on: "turnStart" }) ) {
      if ( (row.while === "aboveZero") && !(Number(actor.system?.attributes?.hp?.value ?? 0) > 0) ) continue;
      if ( (row.while === "raging") && !raging(actor) ) continue;
      const place = `${combat.id}|${combat.round}|${combat.turn}|${item.uuid}${row.feature ? `|${key}` : ""}`;
      const due = grantDue({ paid, place: settledAt(place) ? null : place });
      if ( !due.due ) continue;
      if ( row.deals === "grappled" ) {
        const token = combat.combatant?.token?.object ?? tokenForUuid(actor.uuid);
        const held = grappledBy(actor, token).filter(c => c.certain);
        if ( !held.length ) continue;   // nothing held: nothing dealt, no card, the turn stays open
        paid.add(place);
        void dealToGrappled({ row: { key, ...row }, item, actor, place, held, why: due.why });
        continue;
      }
      // B4 — the grants that are not a roll: Heroic Inspiration written, or a condition's end offered.
      if ( row.grant === "inspiration" ) { paid.add(place); void grantInspiration({ row: { key, ...row }, item, actor, place }); continue; }
      if ( row.grant === "end" ) { paid.add(place); void offerEnd({ row: { key, ...row }, item, actor, bearer: actor, place, on: "turnStart", why: "the start of its turn" }); continue; }
      paid.add(place);
      if ( row.to === "ally" ) { void giveToAlly({ row: { key, ...row }, item, actor }); continue; }
      const block = row.unless?.damagedBy ? blockedBy(actor, item, combat) : null;
      if ( block ) { void blockedCard({ row: { key, ...row }, item, actor, place, block }); continue; }
      void pay({ effect: null, row: { key, ...row }, item, actor, place, why: due.why, on: "turnStart" });
    }
  } catch(err) {
    console.error(`${TITLE} | Turn-start grant failed — apply it by hand.`, err);
  }
});

/** The bearer wears its Rage — an enabled effect of that name, the actor's own or its item's transferred copy. */
const raging = actor => (actor.appliedEffects ?? actor.effects?.contents ?? []).some(e => !e.disabled && (lower(e.name) === "rage"));

// A feature row `on: "use"` (Vitality Surge): the bearer's OWN use of the named item pays it, on the using client.
listen("dnd5e.postUseActivity", "turn-grants", (activity, _usageConfig, results) => {
  try {
    const actor = activity?.actor;
    const used = activity?.item;
    if ( !(actor instanceof Actor) || !used || !actor.isOwner ) return;
    const listed = listedNames(turnGrantEntries());
    for ( const { key, row, item } of featureGrantRows({ table: TURN_GRANTS, features: actor.items.filter(i => i.type === "feat"), listed, answers, on: "use" }) ) {
      if ( !row.of || ![].concat(row.of).some(name => answers(name, used)) ) continue;
      if ( row.activityType && (activity.type !== row.activityType) ) continue;
      const place = `use|${results?.message?.id ?? activity.uuid}|${key}`;
      if ( paid.has(place) ) continue;
      paid.add(place);
      // B4 — a `to: "target"` end row (Physician's Touch): the use's target is the bearer; each target its own offer.
      if ( row.grant === "end" ) {
        const bearers = (row.to === "target") ? targetActorsOf(results?.message ?? null) : [actor];
        for ( const bearer of bearers ) void offerEnd({ row: { key, ...row }, item, actor, bearer, place: `${place}|${bearer.uuid}`, on: "use", why: `${used.name} used` });
        continue;
      }
      void pay({ effect: null, row: { key, ...row }, item, actor, place, why: `${used.name} used`, on: "use" });
    }
  } catch(err) {
    console.error(`${TITLE} | A grant on the use could not be read — apply it by hand.`, err);
  }
});

/** The creatures a use card names as its targets (dnd5e 6 `system.targets`), else the targets picked now. */
function targetActorsOf(message) {
  const out = [];
  for ( const t of (message ? targetsOf(message) : []) ) {
    const a = resolveUuid(t.uuid);
    if ( (a instanceof Actor) && !out.includes(a) ) out.push(a);
  }
  if ( !out.length ) for ( const t of game.user.targets ) if ( t.actor && !out.includes(t.actor) ) out.push(t.actor);
  return out;
}

/* --- B4 — THE GRANTS THAT ARE NOT A ROLL ----------------------------------------------------------------- *
 * `grant: "inspiration"` (Heroic Warrior): Heroic Inspiration written on the sheet when none is held, a card, no
 * choice (R1). `grant: "end"` (Guarded Mind, Self-Restoration, Physician's Touch): a condition the bearer wears is
 * ENDED — asked, a button per condition (the pick is the player's), the pack's activity paid where the row names one;
 * the clock keeps them. The answer is the owner's; the landing (a delete on the bearer, a use on the owner) the GM's.
 * ------------------------------------------------------------------------------------------------------ */

const END_FLAG = "conditionEnd";
const endTimers = new Map();

/** Heroic Inspiration written, once, when none is held. */
async function grantInspiration({ row, item, actor, place }) {
  try {
    if ( actor.type !== "character" ) return;
    if ( actor.system?.attributes?.inspiration === true ) return;   // held already: nothing to give, nothing said
    await actor.update({ "system.attributes.inspiration": true });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: bfCard({ img: item.img ?? null, eyebrow: "Turn start", tone: "good",
        title: `${row.key} — ${actor.name} gains Heroic Inspiration`, subtitle: "none was held — the start of its turn",
        lines: [ruleLine(row.rule)] }),
      flags: { [MODULE_ID]: { [GRANT_FLAG]: { ...statContext(actor.uuid), key: row.key, place, effectUuid: null, actorUuid: actor.uuid,
        grant: "inspiration", why: "the start of its turn" } } }
    });
  } catch(err) { console.error(`${TITLE} | ${row.key} could not write Heroic Inspiration — tick it by hand.`, err); }
}

/** The bearer's applied effects as plain facts (the actor's own and its items' transferred ones). */
function effectFactsOf(bearer) {
  const seen = new Map();
  for ( const e of [...(bearer.appliedEffects ?? []), ...(bearer.effects ?? [])] ) {
    if ( !e || e.disabled || seen.has(e.uuid) ) continue;
    seen.set(e.uuid, { id: e.uuid, name: e.name, statuses: [...(e.statuses ?? [])] });
  }
  return [...seen.values()];
}

const statusLabels = () => Object.fromEntries(Object.entries(CONFIG.DND5E?.conditionTypes ?? {}).map(([k, v]) => [k, v?.label ?? k]));

/** OFFER the end of one of the row's conditions the bearer wears; nothing worn, nothing said. */
async function offerEnd({ row, item, actor, bearer, place, on, why }) {
  try {
    const options = endOptionsOf(row.statuses ?? [], effectFactsOf(bearer), statusLabels());
    if ( !options.length ) return;
    const activity = row.activity ? activityNamed(item, row.activity) : null;
    if ( row.activity && !activity ) { console.warn(`${TITLE} | ${row.key}: no "${row.activity}" on ${item.name} — end it by hand.`); return; }
    const pool = activity ? (poolOf(actor, activity) ?? item) : null;
    const left = pool ? Number(pool.system?.uses?.value ?? 0) : null;
    if ( pool && !(left > 0) ) return;   // nothing to pay with: not offered
    const window = decisionWindow();
    const flag = { status: "pending", answer: null, row: row.key, place, on, why, actorUuid: actor.uuid, actorName: actor.name,
      bearerUuid: bearer.uuid, bearerName: bearer.name, itemId: item.id, activityId: activity?.id ?? null,
      poolName: pool?.name ?? null, poolLeft: left, options, ...statContext(actor.uuid),
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}) };
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: bfCard({ img: item.img ?? null, eyebrow: (on === "use") ? `${why}` : (on === "turnEnd") ? "Turn end" : "Turn start", tone: "pending",
        title: `${row.key} — end a condition on ${bearer.name}?`, subtitle: options.map(o => o.label).join(" · ") }),
      flags: { [MODULE_ID]: { [END_FLAG]: flag } }
    });
  } catch(err) { console.error(`${TITLE} | ${row.key} could not be offered — end the condition by hand.`, err); }
}

const settleEnd = (current, answer, timedOut = false) => {
  if ( current.status !== "pending" ) return false;
  Object.assign(current, { status: "resolved", answer: answer ?? "keep", answeredAt: Date.now(), ...(timedOut ? { timedOut: true } : {}) });
};

/** The owner answers (a status, or "keep"): written on the card, relayed to the GM when this client cannot write it. */
async function answerEnd(message, answer, { timedOut = false } = {}) {
  const flag = message.getFlag(MODULE_ID, END_FLAG);
  if ( flag?.status !== "pending" ) return;
  if ( isActiveGM() || message.canUserModify?.(game.user, "update") ) {
    await queueFlagWrite(message, END_FLAG, current => settleEnd(current, answer, timedOut));
    return;
  }
  if ( !game.users.activeGM ) { ui.notifications?.warn(`${flag.row}: a GM must be on — end it from the sheet by hand.`); return; }
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: resolveUuid(flag.actorUuid) }), content: "",
    whisper: game.users.filter(u => u.isGM).map(u => u.id),
    flags: { [MODULE_ID]: { conditionEndAnswer: { messageId: message.id, answer } } } });
}

registerRelay("conditionEndAnswer", {
  flagKey: END_FLAG, targetOf: a => a.messageId, owns: () => isActiveGM(), cleanup: true,
  fold: (current, a) => settleEnd(current, a.answer)
});

/** The GM lands a pick: the effects carrying the status go from the bearer, the activity pays, the card says so. */
async function landEnd(message) {
  let claimed = false;
  await queueFlagWrite(message, END_FLAG, current => {
    if ( (current.status !== "resolved") || (current.answer === "keep") || current.applied || current.applying ) return false;
    current.applying = true;
    claimed = true;
  });
  if ( !claimed ) return;
  const flag = message.getFlag(MODULE_ID, END_FLAG);
  const record = {};
  try {
    const actor = resolveUuid(flag.actorUuid), bearer = resolveUuid(flag.bearerUuid);
    const item = actor?.items?.get(flag.itemId);
    const option = (flag.options ?? []).find(o => o.status === flag.answer);
    if ( !(actor instanceof Actor) || !(bearer instanceof Actor) || !item || !option ) throw new Error("the feature or the condition left the sheet");
    const activity = flag.activityId ? item.system?.activities?.get(flag.activityId) : null;
    if ( flag.activityId && !activity ) throw new Error("the activity left the sheet");
    if ( activity ) await activity.use({ subsequentActions: false }, { configure: false }, {});
    const gone = [];
    for ( const uuid of option.effectIds ) {
      const effect = fromUuidSync(uuid);
      if ( !effect ) continue;
      if ( effect.parent === bearer ) { await effect.delete(); gone.push(effect.name); }
      else { await effect.update({ disabled: true }); gone.push(effect.name); }
    }
    record.ended = option.status;
    record.gone = gone;
  } catch(err) {
    console.error(`${TITLE} | ${flag.row} failed part-way — check the sheet.`, err);
    record.failed = true;
  } finally {
    await queueFlagWrite(message, END_FLAG, current => { Object.assign(current, record, { applied: true, applying: false }); });
  }
}

registerResumable(END_FLAG, {
  pending: flag => (flag?.status === "resolved") && (flag.answer !== "keep") && !flag.applied && !flag.applying,
  drives: () => isActiveGM(),
  drive: landEnd
});

function armEndTimer(message) {
  const flag = message.getFlag(MODULE_ID, END_FLAG);
  if ( (flag?.status !== "pending") || !flag.deadline || !drivesMomentFor(flag.actorUuid ?? null) ) return;
  armDeadline(endTimers, message.id, flag.deadline, async () => {
    const live = game.messages.get(message.id);
    if ( live?.getFlag(MODULE_ID, END_FLAG)?.status === "pending" ) await answerEnd(live, "keep", { timedOut: true });
  });
}

async function showEndPopup(message) {
  const flag = message.getFlag(MODULE_ID, END_FLAG);
  if ( flag?.status !== "pending" ) return;
  const actor = resolveUuid(flag.actorUuid);
  if ( !actor ) return;
  const row = TURN_GRANTS[flag.row] ?? null;
  const cost = flag.poolName ? ` · 1 ${flag.poolName} (${flag.poolLeft} left)` : " · free";
  await openMomentPopup(message, END_FLAG, actor, {
    title: `${flag.row} — ${flag.actorName}`, icon: "fa-solid fa-hand-sparkles", width: 420,
    content: bfCard({ img: actor.items.get(flag.itemId)?.img ?? null, eyebrow: (flag.on === "turnEnd") ? "Turn end" : (flag.on === "use") ? flag.why : "Turn start", tone: "pending",
      title: `End a condition on ${flag.bearerName}?`, subtitle: `${(flag.options ?? []).map(o => `${o.label} (${o.names.join(", ")})`).join(" · ")}${cost}`,
      lines: [row?.rule ? ruleLine(row.rule) : ""] }) + holdBarHTML(flag, "to answer"),
    buttons: [
      ...(flag.options ?? []).map((o, i) => ({ action: o.status, label: `End ${o.label}`, default: i === 0, callback: () => { void answerEnd(message, o.status); } })),
      { action: "keep", label: "Keep", callback: () => { void answerEnd(message, "keep"); } }
    ]
  });
}

/** The card's line, by the offer's state. */
function endLine(flag) {
  if ( flag.answer === "keep" ) return `${flag.row} — nothing ended${flag.timedOut ? " (timer)" : ""}`;
  if ( flag.applied ) {
    if ( flag.failed ) return `${flag.row} — could not end ${flag.answer} (see the console)`;
    const label = (flag.options ?? []).find(o => o.status === flag.ended)?.label ?? flag.ended;
    return `${flag.row} — ${label} ended on ${flag.bearerName}${flag.poolName ? ` · 1 ${flag.poolName}` : ""}`;
  }
  if ( flag.status === "resolved" ) return `${flag.row} — ending…`;
  return `${flag.row} — end a condition on ${flag.bearerName}? ${(flag.options ?? []).map(o => o.label).join(" · ")}`;
}

listen("dnd5e.renderChatMessage", "turn-grants", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, END_FLAG);
    if ( !flag ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-condition-end-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-condition-end-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-hand-sparkles" data-tooltip="${esc(flag.row)}"></i> ${esc(endLine(flag))}`
      + ((flag.status === "pending") ? ` ${holdBarHTML(flag, "to answer")}` : "");
    if ( flag.status === "pending" ) {
      const actor = resolveUuid(flag.actorUuid);
      if ( canAnswerFor(actor) ) {
        const shown = popupKey(message.id, END_FLAG);
        if ( !shownMoments.has(shown) ) { shownMoments.add(shown); void showEndPopup(message); }
        div.appendChild(momentButton("Answer", () => { void showEndPopup(message); }));
      }
      scheduleBarSync(div);
      armEndTimer(message);
    }
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The condition-end line could not render.`, err); }
});

// An answer anywhere closes the popup everywhere (law 4); the clock stands down with it.
listen("updateChatMessage", "turn-grants", message => {
  const flag = message.getFlag(MODULE_ID, END_FLAG);
  if ( !flag ) return;
  if ( flag.status === "pending" ) { armEndTimer(message); return; }
  disarmDeadline(endTimers, message.id);
  const open = livePopups.get(popupKey(message.id, END_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
});

listen("deleteChatMessage", "turn-grants", message => { disarmDeadline(endTimers, message.id); });

/** A `to: "ally"` row (Life-Giving Force): the amount rolled on the bearer's numbers, then GIVEN — the rest song's pick. */
async function giveToAlly({ row, item, actor }) {
  try {
    const activity = row.activity ? activityNamed(item, row.activity) : activityOfType(item, "heal");
    const h = activity?.healing ?? null;
    const raw = h ? riderPartFormula({ number: h.number, denomination: h.denomination, custom: h.custom, bonus: h.bonus }) : null;
    if ( !raw ) { console.warn(`${TITLE} | ${row.key}: no healing part on "${row.activity}" — give it by hand.`); return; }
    const roll = await new Roll(raw, activity.getRollData?.() ?? item.getRollData?.() ?? {}).evaluate();
    if ( !(roll.total > 0) ) return;
    await askHandOut(actor, { name: row.key, row, item, amount: roll.total, roll });
  } catch(err) {
    console.error(`${TITLE} | ${row?.key ?? "The gift"} could not be asked — give it by hand.`, err);
  }
}

/** A `deals` row's damage part: the row's activity, else the item's first damage activity. */
function damagePartOf(item, row) {
  const activity = row.activity ? activityNamed(item, row.activity) : activityOfType(item, "damage");
  const part = activity?.damage?.parts?.[0] ?? null;
  const raw = part ? riderPartFormula({ number: part.number, denomination: part.denomination, custom: part.custom, bonus: part.bonus }) : null;
  return { activity, raw, type: [...(part?.types ?? [])][0] ?? "bludgeoning" };
}

/** The grappler's row (Barbed Hide): its damage rolled once on its own numbers, landed on every creature it holds. */
async function dealToGrappled({ row, item, actor, place, held, why }) {
  try {
    const { activity, raw, type } = damagePartOf(item, row);
    if ( !raw ) { console.warn(`${TITLE} | ${row.key}: no damage part on "${row.activity ?? "its damage activity"}" — deal it by hand.`); return; }
    const roll = await new Roll(raw, activity.getRollData?.() ?? item.getRollData?.() ?? {}).evaluate();
    const targets = held.map(c => ({ uuid: c.uuid, name: c.name }));
    const card = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [roll],
      content: bfCard({ img: item.img ?? null, eyebrow: "Turn start", tone: "bad",
        title: `${row.key} — ${actor.name} deals ${roll.total} ${type} damage to ${targets.map(t => t.name).join(", ")}`,
        subtitle: `the creature${targets.length === 1 ? "" : "s"} it grapples — ${why}`,
        lines: [ruleLine(row.rule), row.caveat ? `<span style="opacity:0.8;">${row.caveat}</span>` : null] }),
      flags: { [MODULE_ID]: { [GRANT_FLAG]: { ...statContext(actor.uuid), key: row.key, place, effectUuid: null, actorUuid: actor.uuid,
        deals: "grappled", targets, formula: raw, total: roll.total, type, why } } }
    });
    if ( card ) await applyDamagesWithReceipt(card, targets, [{ value: roll.total, type, properties: new Set() }], { note: row.key });
  } catch(err) {
    console.error(`${TITLE} | ${row?.key ?? "The grappler's damage"} failed — deal it by hand.`, err);
  }
}

/** The `unless.damagedBy` judge: the types the bearer's copy names, against the receipts since its last turn. */
function blockedBy(actor, item, combat) {
  const labels = Object.fromEntries(Object.entries(CONFIG.DND5E.damageTypes ?? {}).map(([k, v]) => [k, v?.label ?? k]));
  const types = blockingTypes(item.system?.description?.value ?? "", labels);
  if ( !types.length ) return null;
  const entries = game.messages.contents.flatMap(m => m.getFlag(MODULE_ID, "receipt")?.targets ?? []);
  const verdict = damagedSince({ entries, uuid: actor.uuid, combatId: combat.id, round: combat.round, turn: combat.turn, types });
  return verdict.blocked ? { type: verdict.type, label: labels[verdict.type] ?? verdict.type, types } : null;
}

/** Nothing paid: the card says which damage stopped it (R5). No receipt — nothing landed. */
async function blockedCard({ row, item, actor, place, block }) {
  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: bfCard({ img: item.img ?? null, eyebrow: "Turn start", tone: "neutral",
        title: `${row.key} — ${actor.name} regains nothing this turn`,
        subtitle: `it took ${block.label} damage since its last turn`,
        lines: [ruleLine(row.rule)] }),
      flags: { [MODULE_ID]: { [GRANT_FLAG]: { ...statContext(actor.uuid), key: row.key, place, effectUuid: null,
        actorUuid: actor.uuid, blocked: block.type, why: `took ${block.label} damage since its last turn` } } }
    });
  } catch(err) {
    console.error(`${TITLE} | ${row.key}'s card could not post.`, err);
  }
}

/** The grant: the activity's healing part as the pack wrote it, rolled on the CASTER's numbers (a feature
 * row's caster is the bearer itself), landed. A `deals` row: the damage part, rolled on the ORIGIN's numbers,
 * landed as damage on the bearer. */
async function pay({ effect, row, item, actor, place, why, on = "turnStart" }) {
  try {
    const deals = row.deals === true;
    const activity = deals ? damagePartOf(item, row).activity : (row.activity ? activityNamed(item, row.activity) : activityOfType(item, "heal"));
    const part = deals ? (activity?.damage?.parts?.[0] ?? null) : (activity?.healing ?? null);
    const raw = part ? riderPartFormula({ number: part.number, denomination: part.denomination, custom: part.custom, bonus: part.bonus }) : null;
    if ( !raw ) { console.warn(`${TITLE} | ${row.key}: no ${deals ? "damage" : "healing"} part on "${row.activity ?? (deals ? "its damage activity" : "its heal activity")}" — ${deals ? "deal" : "grant"} it by hand.`); return; }
    const caster = item.actor ?? null;
    const roll = await new Roll(raw, activity.getRollData?.() ?? item.getRollData?.() ?? {}).evaluate();
    const type = [...(part.types ?? [])][0] ?? (deals ? "bludgeoning" : "healing");
    const card = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster ?? actor }),
      rolls: deals ? [roll] : [],
      content: bfCard({ img: item.img ?? null, eyebrow: (on === "use") ? (row.of ?? "Use") : (on === "turnEnd") ? "Turn end" : "Turn start", tone: deals ? "bad" : "good",
        title: grantTitle({ spell: row.key, bearer: actor.name, total: roll.total, type, deals }),
        subtitle: effect ? `${effect.name} stands on ${actor.name} — ${why}` : `${actor.name}'s own ${row.key} — ${why}`,
        lines: [ruleLine(row.rule), row.caveat ? `<span style="opacity:0.8;">${row.caveat}</span>` : null] }),
      flags: { [MODULE_ID]: { [GRANT_FLAG]: { ...statContext(caster?.uuid ?? null), key: row.key, place, effectUuid: effect?.uuid ?? null,
        actorUuid: actor.uuid, formula: raw, total: roll.total, type, why, ...(deals ? { deals: true, on } : {}) } } }
    });
    if ( card ) await applyDamagesWithReceipt(card, [{ uuid: actor.uuid, name: actor.name }], [{ value: roll.total, type, properties: new Set() }], { note: row.key });
  } catch(err) {
    console.error(`${TITLE} | Turn-start grant failed — apply it by hand.`, err);
  }
}
