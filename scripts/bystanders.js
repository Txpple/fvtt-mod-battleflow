// @ts-check
/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE BYSTANDER'S BEND on a SAVE or a CHECK (RULINGS *The full
 * release — the order*, Q2 option A). The attack side rides the hold (hold/); this file is the other two
 * D20 Tests. A DEMANDED save's verdict is WITHHELD while a bystander is asked (the d20 fold's seam,
 * `registerWithhold`), and its bent roll REPLACES the total in `SAVE_FOLDS`. A check has no DC, so its bend
 * is stated as arithmetic and the verdict stays the DM's (the raw-check shape). One flag on the ROLL
 * message, `bystanderRoll`; a bystander who does not own the roll answers through the relay.
 */
import { MODULE_ID, TITLE, queueFlagWrite, canAnswerFor, keepsMessage, statContext, decisionWindow, activeCombatFor } from "./core.js";
import { INTERRUPT_ROLLS } from "./decide/registry.js";
import { bystanderMatters, dieMaxOf, dieOutcome, neutraliseOutcome } from "./decide/rescue-hit.js";
import { bfCard, esc, holdBarHTML, popupKey, tickRowsHTML } from "./decide/present.js";
import { activityNamed, featureNamed, resolveUuid, bystanderRows, bystanderDie, d20FactsOf } from "./lookup.js";
import { nearestFeet, tokenForUuid } from "./geometry.js";
import { poolOf, reactionSpent, spendReaction, spendPoolUses, bystanderMuted, muteBystander } from "./shared.js";
import { armAskTimer, cardRow, livePopups, openMomentPopup, registerRelay, registerWithhold, resumeWithheld, shownMoments } from "./ui.js";
import { listen } from "./dispatch.js";

const KEY = "bystanderRoll";
const timers = new Map();

/** What the test is called on a popup and a card. */
const TEST_WORD = { save: "saving throw", check: "check" };

/**
 * The bystanders for one creature's save or check: any side within the row's feet of the ROLLER, the
 * roller itself included. The WANT is the side's (a friend wants it to pass, a foe to fail); a subtracting
 * die bends only a foe's roll, an adding one only a friend's. THE MARGIN GATE judges a known DC; a check has
 * none, so it asks (the ruling).
 * @param {Actor} roller
 * @param {any} roll
 * @param {"save"|"check"} testKind
 * @param {number|null} dc
 */
function bystandersFor(roller, roll, testKind, dc) {
  const token = tokenForUuid(roller?.uuid);
  const rollerSide = token?.document?.disposition;
  const facts = d20FactsOf(roll);
  if ( !token || !roll || !Number.isFinite(facts.kept) ) return [];
  const total = Number(roll.total);
  const known = Number.isFinite(Number(dc)) && (dc !== null);
  const out = [];
  for ( const key of bystanderRows(testKind) ) {
    const row = INTERRUPT_ROLLS[key];
    for ( const other of (canvas.tokens?.placeables ?? []) ) {
      const side = other.document?.disposition;
      if ( (side !== 1) && (side !== -1) ) continue;
      const actor = other.actor;
      if ( !actor || out.some(b => (b.uuid === actor.uuid) && (b.row === key)) ) continue;
      if ( ((actor.system?.attributes?.hp?.value ?? 0) <= 0) || actor.statuses?.has?.("incapacitated") ) continue;
      const friendly = side === rollerSide;
      if ( (row.bend === "die") && (friendly === ((row.sign ?? 1) < 0)) ) continue;
      const feet = nearestFeet(other, token);
      if ( (feet === null) || (feet > row.bystander) ) continue;
      const item = featureNamed(actor, key);
      const activity = item ? activityNamed(item, row.activity) : null;
      if ( !item || !activity ) continue;
      if ( row.reaction && reactionSpent(actor) ) continue;
      const pool = poolOf(actor, activity) ?? item;
      if ( row.uses && !(Number(pool?.system?.uses?.value ?? 0) > 0) ) continue;
      if ( bystanderMuted(actor, key) ) continue;
      const die = (row.bend === "die") ? bystanderDie(actor, row) : null;
      if ( (row.bend === "die") && !dieMaxOf(die) ) continue;
      const matters = known
        ? bystanderMatters({ bend: row.bend, sign: row.sign ?? 1, dieMax: dieMaxOf(die), want: friendly ? "hit" : "miss",
            kept: Number(facts.kept), plain: facts.plain, total, target: Number(dc), mode: facts.mode, critAt: 99, fumbleAt: 0 })
        : ((row.bend === "neutralise") ? neutraliseOutcome({ mode: facts.mode, kept: Number(facts.kept), plain: facts.plain, total }).changed : true);
      if ( !matters ) continue;
      out.push({ uuid: actor.uuid, name: other.document?.name ?? actor.name, row: key, itemId: item.id, activityId: activity.id ?? null,
        want: friendly ? "pass" : "fail", passed: false, die });
    }
  }
  return out;
}

/**
 * Stamp the offer on the roll message; true when someone is asked.
 * @param {ChatMessage} rollMessage
 * @param {Actor} roller
 * @param {"save"|"check"} testKind
 * @param {{dc?: number|null, resume?: object|null}} [opts]
 */
async function stampBystanders(rollMessage, roller, testKind, { dc = null, resume = null } = {}) {
  const roll = rollMessage.rolls?.[0];
  const guards = bystandersFor(roller, roll, testKind, dc);
  if ( !guards.length ) return false;
  const window = decisionWindow();
  await rollMessage.setFlag(MODULE_ID, KEY, {
    status: "pending", testKind, rollerUuid: roller.uuid, rollerName: tokenForUuid(roller.uuid)?.document?.name ?? roller.name,
    baseTotal: Number(roll?.total), ...(Number.isFinite(Number(dc)) && (dc !== null) ? { dc: Number(dc) } : {}),
    ...(resume ? { resume } : {}),
    guards, answer: null, bent: null,
    ...statContext(roller.uuid),
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
  });
  armTimer(rollMessage);
  return true;
}

const armTimer = message => armAskTimer(timers, message, KEY, live => queueFlagWrite(live, KEY, current => {
  if ( current.status !== "pending" ) return false;
  for ( const g of (current.guards ?? []) ) g.passed = true;
  Object.assign(current, { status: "resolved", answer: "pass", timedOut: true, answeredAt: Date.now() });
}));

// A DEMANDED save: the verdict waits while a bystander is asked. ⚠ Fails open: a broken offer never swallows a save.
registerWithhold(KEY, {
  offer: async (rollMessage, { by, card, uuid, total, dc }) => {
    try {
      const existing = rollMessage.getFlag(MODULE_ID, KEY);
      if ( existing ) return existing.status === "pending";
      if ( !Number.isFinite(total) || !Number.isFinite(dc) ) return false;
      const roller = await fromUuid(uuid);
      if ( !(roller instanceof Actor) ) return false;
      return await stampBystanders(rollMessage, roller, "save", { dc, resume: { cardId: card.id, uuid, ...(by ? { by } : {}) } });
    } catch(err) {
      console.error(`${TITLE} | The bystander offer on a save failed — the save folds as rolled.`, err);
      return false;
    }
  }
});

// A CHECK: no DC exists, so the offer stamps on the roller's own message and nothing waits on it.
for ( const hook of ["dnd5e.rollAbilityCheck", "dnd5e.rollSkill", "dnd5e.rollToolCheck"] ) {
  listen(hook, "bystanders", async (rolls, data) => {
    try {
      const roller = data?.subject;
      const message = rolls?.[0]?.parent;
      if ( !(roller instanceof Actor) || !(message instanceof ChatMessage) || !message.isAuthor ) return;
      if ( message.getFlag(MODULE_ID, KEY) ) return;
      await stampBystanders(message, roller, "check");
    } catch(err) {
      console.error(`${TITLE} | The bystander offer on a check failed.`, err);
    }
  });
}

/* --- THE ANSWER: first act wins; a pass only once everyone asked has passed. */

/** Fold one answer into the flag (the owner's write, or the relay's). False when it changes nothing. */
function foldAnswer(current, envelope, userId = null) {
  if ( current?.status !== "pending" ) return false;
  const guard = (current.guards ?? []).find(g => g.uuid === envelope.by);
  if ( !guard || guard.passed ) return false;
  if ( envelope.answer === "pass" ) {
    guard.passed = true;
    if ( (current.guards ?? []).every(g => g.passed) ) Object.assign(current, { status: "resolved", answer: "pass", answeredAt: Date.now() });
    return;
  }
  Object.assign(current, { status: "resolved", answer: "roll", by: guard.uuid, byName: guard.name, rescue: envelope.rescue ?? guard.row,
    bent: envelope.bent ?? null, poolSpend: envelope.poolSpend ?? null, answeredAt: Date.now(), answeredBy: userId });
}

registerRelay("bystanderRollAnswer", {
  flagKey: KEY,
  targetOf: envelope => envelope.messageId,
  owns: (flag, target) => (flag.status === "pending") && keepsMessage(target),
  fold: (current, envelope, message) => foldAnswer(current, envelope, message.author?.id ?? null)
});

/** Record an answer: the roll's owner writes it, anyone else sends its own message (ARCHITECTURE §3). */
async function sendAnswer(message, envelope, actor) {
  if ( message.isOwner ) {
    await queueFlagWrite(message, KEY, current => foldAnswer(current, envelope, game.user.id));
    return;
  }
  const bending = envelope.answer === "roll";
  await ChatMessage.create({
    content: bfCard({ img: actor?.items?.get?.(envelope.itemId)?.img ?? null, eyebrow: bending ? `Reaction — ${envelope.rescue}` : "Reaction — passed",
      title: bending ? envelope.rescue : "Lets it stand", subtitle: `${actor?.name ?? "A bystander"} · ${envelope.rollerName ?? ""}`,
      tone: bending ? "good" : "neutral", lines: [] }),
    speaker: ChatMessage.getSpeaker({ actor }),
    flags: { [MODULE_ID]: { bystanderRollAnswer: envelope } }
  });
}

/** The bystander's answer: the cost paid by hand, the bend rolled in the open (a die) or read (neutralise). */
async function bystanderAnswer(message, guard, choice) {
  const flag = message.getFlag(MODULE_ID, KEY);
  if ( flag?.status !== "pending" ) return;
  const actor = resolveUuid(guard.uuid);
  const base = { messageId: message.id, by: guard.uuid, itemId: guard.itemId, rescue: guard.row, rollerName: flag.rollerName };
  if ( choice === "mute" ) {
    await muteBystander(actor, guard.row, { img: actor?.items?.get?.(guard.itemId)?.img ?? null })
      .catch(err => console.warn(`${TITLE} | Could not mute ${guard.row}.`, err));
    choice = "pass";
  }
  if ( choice === "pass" ) return sendAnswer(message, { ...base, answer: "pass" }, actor);
  const row = INTERRUPT_ROLLS[guard.row];
  const item = actor?.items?.get?.(guard.itemId) ?? null;
  if ( !row || !item ) {
    ui.notifications.warn(`${TITLE}: could not find ${guard.row} on ${guard.name}.`);
    return;
  }
  if ( row.reaction && reactionSpent(actor) ) {
    ui.notifications.warn(`${TITLE}: ${guard.name}'s Reaction is already spent this round.`);
    return;
  }
  const activity = item.system?.activities?.get(guard.activityId) ?? activityNamed(item, row.activity);
  const pool = (activity ? poolOf(actor, activity) : null) ?? item;
  if ( row.uses && !(Number(pool?.system?.uses?.value ?? 0) > 0) ) {
    ui.notifications.warn(`${TITLE}: ${guard.name} has no ${pool?.name ?? guard.row} left.`);
    return;
  }
  const roll = message.rolls?.[0];
  const facts = d20FactsOf(roll);
  if ( !roll || !Number.isFinite(facts.kept) ) return;
  const poolSpend = row.uses ? await spendPoolUses(actor, pool, guard.row, 1, (pool === item) ? null : pool.name)
    .catch(err => { console.warn(`${TITLE} | Could not spend a use for ${guard.row}.`, err); return null; }) : null;
  if ( row.reaction ) await spendReaction(actor, { origin: item.uuid, what: guard.row });
  let bent = null;
  if ( row.bend === "neutralise" ) {
    bent = neutraliseOutcome({ mode: facts.mode, kept: Number(facts.kept), plain: facts.plain, total: Number(roll.total), critAt: 99, fumbleAt: 0, faces: facts.faces });
  } else {
    let n = 0;
    try {
      const die = await new Roll(String(guard.die)).evaluate();
      await die.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${guard.row} — on ${flag.rollerName}'s ${TEST_WORD[flag.testKind] ?? "roll"}` });
      n = Math.max(0, Number(die.total) || 0);
    } catch(err) {
      console.error(`${TITLE} | ${guard.row}'s die could not be rolled — bend the roll by hand.`, err);
    }
    bent = dieOutcome({ kept: Number(facts.kept), total: Number(roll.total), add: (row.sign ?? 1) * n, critAt: 99, fumbleAt: 0 });
  }
  return sendAnswer(message, { ...base, answer: "roll", bent, poolSpend }, actor);
}

/* --- THE RESUME: a withheld save is finished once, by the roll's keeper. */

const resuming = new Set();
listen("updateChatMessage", "bystanders", message => {
  const flag = message.getFlag(MODULE_ID, KEY);
  if ( !flag ) return;
  closeAnswered(message, flag);
  if ( (flag.status !== "resolved") || !flag.resume || flag.resumed || !keepsMessage(message) ) return;
  if ( resuming.has(message.id) ) return;
  resuming.add(message.id);
  void (async () => {
    try {
      let claimed = false;
      await queueFlagWrite(message, KEY, current => { if ( current.resumed ) return false; current.resumed = true; claimed = true; });
      if ( claimed ) await resumeWithheld(flag.resume.by ?? null, flag.resume, message);
    } catch(err) {
      console.error(`${TITLE} | Resuming the save a bystander held failed.`, err);
    } finally {
      resuming.delete(message.id);
    }
  })();
});

/** A decision made anywhere closes its popups (ARCHITECTURE §5 law 4). */
function closeAnswered(message, flag) {
  for ( const g of (flag.guards ?? []) ) {
    const open = livePopups.get(popupKey(message.id, `${KEY}|${g.uuid}`));
    if ( open && ((flag.status !== "pending") || g.passed) ) void open.close();
  }
}

/* --- THE VIEWS: the popup (each bystander its own), the card row. */

function situation(flag, roll, guard, row) {
  const facts = d20FactsOf(roll);
  const vs = Number.isFinite(flag.dc) ? ` vs DC <strong>${flag.dc}</strong>` : "";
  const test = TEST_WORD[flag.testKind] ?? "roll";
  if ( row?.bend === "neutralise" ) {
    const o = neutraliseOutcome({ mode: facts.mode, kept: Number(facts.kept), plain: facts.plain, total: Number(roll?.total), critAt: 99, fumbleAt: 0 });
    return `${esc(flag.rollerName)}'s ${test}, rolled with <strong>${facts.mode === "advantage" ? "Advantage" : "Disadvantage"}</strong>: `
      + `${facts.faces.join(" and ")} → <strong>${roll?.total}</strong>${vs}. Take it away and the <strong>first d20 (${o.stood})</strong> stands — <strong>${o.total}</strong>.`;
  }
  const max = Number(dieMaxOf(guard.die)) || 0;
  const minus = (row?.sign ?? 1) < 0;
  return `${esc(flag.rollerName)}'s ${test}: <strong>${roll?.total}</strong>${vs}.`
    + (Number.isFinite(flag.dc) ? ` A ${esc(guard.die)} can turn it: ${roll?.total} ${minus ? "−" : "+"} ${max} = ${minus ? roll.total - max : roll.total + max}.`
      : " No DC is known — the arithmetic goes on the card and the DM rules.");
}

async function showPopup(message, flag, guard) {
  const actor = resolveUuid(guard.uuid);
  const row = INTERRUPT_ROLLS[guard.row] ?? null;
  const item = actor?.items?.get?.(guard.itemId) ?? null;
  const activity = item ? (item.system?.activities?.get(guard.activityId) ?? activityNamed(item, row?.activity)) : null;
  const pool = (activity ? poolOf(actor, activity) : null) ?? item;
  const poolWord = (pool && (pool !== item)) ? `${pool.name} ` : "";
  const tag = [row?.reaction ? "a Reaction" : null, row?.uses ? `${poolWord}${Number(pool?.system?.uses?.value ?? 0)} left` : null].filter(Boolean).join(" · ");
  const dice = (row?.bend === "neutralise") ? "the first d20 stands" : `${(row?.sign ?? 1) < 0 ? "−" : "+"}${guard.die ?? "a die"}`;
  const test = TEST_WORD[flag.testKind] ?? "roll";
  const self = guard.uuid === flag.rollerUuid;
  const dialog = await openMomentPopup(message, `${KEY}|${guard.uuid}`, actor, {
    title: `${guard.row} — ${self ? "your" : `${flag.rollerName}'s`} ${test}`, icon: "fa-solid fa-comment-dots", width: 460,
    content: bfCard({ img: item?.img ?? actor?.img ?? null, eyebrow: `Reaction — ${guard.row}`, tone: "pending",
      title: `${self ? "You rolled" : `${flag.rollerName} rolled`} a ${test}`, subtitle: `within ${row?.bystander ?? "?"} ft of you` })
      + holdBarHTML(flag) + `<div style="padding:0.4rem 0.1rem;">${situation(flag, message.rolls?.[0], guard, row)}</div>`
      + tickRowsHTML({ name: "bf-bystander-roll", rows: [{ key: guard.row, name: guard.row, dice, tag, off: null, rule: row?.rule ?? "" }] }),
    buttons: [
      { action: "answer", label: "Answer", default: true, callback: (_event, button) => {
        if ( !button?.form?.querySelector?.('input[name="bf-bystander-roll"]:checked') ) return;
        void bystanderAnswer(message, guard, "roll");
      } },
      { action: "pass", label: "Pass", callback: () => bystanderAnswer(message, guard, "pass") },
      // Only where a combat runs: out of one there is nothing to mute.
      ...(activeCombatFor(actor) ? [{ action: "mute", label: "Not this combat", callback: () => bystanderAnswer(message, guard, "mute") }] : [])
    ]
  });
  const form = dialog?.element?.querySelector?.("form") ?? dialog?.element ?? null;
  const box = form?.querySelector?.('input[name="bf-bystander-roll"]') ?? null;
  const answer = form?.querySelector?.('button[data-action="answer"]') ?? null;
  if ( box ) box.checked = true;
  box?.addEventListener("change", () => { if ( answer ) answer.disabled = !box.checked; });
}

/** The line a bent check or save carries: who bent it, and the arithmetic (a check's verdict is the DM's). */
function bentLine(flag) {
  const b = flag.bent;
  if ( !b ) return "";
  const who = `${esc(flag.rescue)} (${esc(flag.byName ?? "")})`;
  const change = (b.how === "neutralised") ? `no Advantage or Disadvantage — the first d20 (${b.stood}) stands`
    : `${Number(b.add) < 0 ? "−" : "+"}${Math.abs(Number(b.add) || 0)}`;
  const tail = (flag.testKind === "check") ? " — ask your DM whether it still succeeds" : Number.isFinite(flag.dc) ? ` vs DC ${flag.dc}` : "";
  return `<strong>${who}</strong> ${change}: ${b.firstTotal} → <strong>${b.total}</strong>${tail}`;
}

listen("dnd5e.renderChatMessage", "bystanders", cardRow((message, host) => {
  const flag = message.getFlag(MODULE_ID, KEY);
  if ( !flag ) return;
  const line = document.createElement("div");
  line.className = "battleflow-bystander-roll";
  line.style.margin = "0.3rem 0 0";
  if ( flag.status === "pending" ) {
    const waiting = (flag.guards ?? []).filter(g => !g.passed).map(g => `${g.row} (${g.name})`).join(", ");
    line.innerHTML = bfCard({ eyebrow: "Reaction — held", tone: "pending", title: `Waiting on ${waiting}`, subtitle: flag.rollerName ?? "", lines: [] }) + holdBarHTML(flag);
    armTimer(message);
    for ( const guard of (flag.guards ?? []) ) {
      if ( guard.passed || !canAnswerFor(resolveUuid(guard.uuid)) ) continue;
      const shown = popupKey(message.id, `${KEY}|${guard.uuid}`);
      if ( shownMoments.has(shown) ) continue;
      shownMoments.add(shown);
      void showPopup(message, flag, guard);
    }
  } else if ( flag.answer === "roll" ) {
    line.innerHTML = bfCard({ eyebrow: `Reaction — ${esc(flag.rescue)}`, tone: "good", title: esc(flag.rescue), subtitle: flag.rollerName ?? "", lines: [bentLine(flag)] });
  } else return;
  host.appendChild(line);
}));
