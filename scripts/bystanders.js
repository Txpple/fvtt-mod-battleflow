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
import { INTERRUPT_ROLLS, STORED_DICE } from "./decide/registry.js";
import { bystanderMatters, dieMaxOf, dieOutcome, guardSign, neutraliseOutcome, rerollOutcome, signFor } from "./decide/rescue-hit.js";
import { bfCard, esc, holdBarHTML, popupKey, tickRowsHTML } from "./decide/present.js";
import { activityNamed, featureNamed, resolveUuid, bystanderRows, bystanderDie, d20FactsOf, rerollD20 } from "./lookup.js";
import { nearestFeet, tokenForUuid } from "./geometry.js";
import { poolOf, reactionSpent, spendReaction, spendPoolUses, bystanderMuted, muteBystander, STORED_FLAG, spendStoredFace, storedChipOf, storedFacesUsable, withTargets } from "./shared.js";
import { facesThatTurn, setOutcome } from "./decide/stored-dice.js";
import { foldRise } from "./decide/dice-chips.js";
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
 * @param {{statuses?: string[]}} [demand]  what the save is against (the demand card's), for a row's `against`
 */
function bystandersFor(roller, roll, testKind, dc, demand = {}) {
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
      // B4 — the sign follows the side ("either", Bend Luck) or the stored omen's parity ("omen", Cosmic Omen).
      const omenFace = (row.sign === "omen") ? (storedChipOf(actor, row.stored)?.getFlag(MODULE_ID, STORED_FLAG)?.faces?.[0] ?? null) : null;
      const sign = signFor(row, { friendly, face: omenFace }) ?? NaN;
      if ( !Number.isFinite(sign) ) continue;   // an omen with no face rolled yet
      if ( (row.bend === "die") && (friendly === (sign < 0)) ) continue;
      // A reroll is a gift (a friend's failure only), and only against an effect the row names (Countercharm's conditions).
      if ( (row.bend === "reroll") && (!friendly || !known) ) continue;
      // A twist (Beguiling Twist, B2) rides anyone's SUCCESS against the row's conditions — any side, the DC known.
      if ( (row.bend === "twist") && (!known || !(total >= Number(dc))) ) continue;
      if ( row.against && !(demand.statuses ?? []).some(s => row.against.includes(s)) ) continue;
      const feet = nearestFeet(other, token);
      if ( (feet === null) || (Number.isFinite(row.bystander) && (feet > row.bystander)) ) continue;
      const item = featureNamed(actor, key);
      const activity = item ? (row.omen ? activityNamed(item, (sign > 0) ? row.omen.even : row.omen.odd) : activityOf(item, row)) : null;
      if ( !item || (!activity && !row.stored && !row.omen) ) continue;
      // A STORED face (Portent): asked when a face in hand turns the verdict (a known DC; a check has none — not asked).
      if ( row.bend === "set" ) {
        const chip = storedChipOf(actor, row.stored);
        if ( !known || !chip || !storedFacesUsable(chip, STORED_DICE[row.stored]) || bystanderMuted(actor, key) ) continue;
        const faces = facesThatTurn({ faces: chip.getFlag(MODULE_ID, STORED_FLAG)?.faces ?? [], kept: Number(facts.kept), total,
          target: Number(dc), want: friendly ? "pass" : "fail" });
        if ( !faces.length ) continue;
        out.push({ uuid: actor.uuid, name: other.document?.name ?? actor.name, row: key, itemId: item.id, activityId: null,
          want: friendly ? "pass" : "fail", passed: false, die: null, faces });
        continue;
      }
      if ( row.reaction && reactionSpent(actor) ) continue;
      const pool = poolOf(actor, activity) ?? item;
      if ( row.uses && !(Number(pool?.system?.uses?.value ?? 0) > 0) ) continue;
      if ( bystanderMuted(actor, key) ) continue;
      const die = (row.bend === "die") ? bystanderDie(actor, row) : null;
      if ( (row.bend === "die") && !dieMaxOf(die) ) continue;
      const matters = (row.bend === "twist") ? true : known
        ? bystanderMatters({ bend: row.bend, sign, dieMax: dieMaxOf(die), want: friendly ? "hit" : "miss",
            kept: Number(facts.kept), plain: facts.plain, total, target: Number(dc), mode: facts.mode, critAt: 99, fumbleAt: 0 })
        : ((row.bend === "neutralise") ? neutraliseOutcome({ mode: facts.mode, kept: Number(facts.kept), plain: facts.plain, total }).changed : true);
      if ( !matters ) continue;
      out.push({ uuid: actor.uuid, name: other.document?.name ?? actor.name, row: key, itemId: item.id, activityId: activity.id ?? null,
        want: friendly ? "pass" : "fail", passed: false, die, sign });
    }
  }
  return out;
}

/** The row's activity on the item — by name, or the item's FIRST where the pack left it unnamed (`activity: null`). */
const activityOf = (item, row) => (row.activity === null)
  ? ([...(item?.system?.activities ?? [])][0] ?? null) : activityNamed(item, row.activity);

/**
 * Stamp the offer on the roll message; true when someone is asked.
 * @param {ChatMessage} rollMessage
 * @param {Actor} roller
 * @param {"save"|"check"} testKind
 * @param {{dc?: number|null, resume?: object|null, demand?: {statuses?: string[]}}} [opts]
 */
async function stampBystanders(rollMessage, roller, testKind, { dc = null, resume = null, demand = {} } = {}) {
  const roll = rollMessage.rolls?.[0];
  const guards = bystandersFor(roller, roll, testKind, dc, demand);
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
      const demand = card.getFlag(MODULE_ID, "saves")?.demand ?? {};
      return await stampBystanders(rollMessage, roller, "save", { dc, demand: { statuses: demand.statuses ?? [] }, resume: { cardId: card.id, uuid, ...(by ? { by } : {}) } });
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
    bent: envelope.bent ?? null, poolSpend: envelope.poolSpend ?? null, ...(envelope.twist ? { twist: envelope.twist } : {}),
    answeredAt: Date.now(), answeredBy: userId });
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

/**
 * The bystander's answer: the cost paid by hand, the bend rolled in the open (a die), read (neutralise) or stored (set).
 * @param {ChatMessage} message
 * @param {any} guard
 * @param {string} choice
 * @param {number|null} [face]  the stored face picked (Portent)
 */
async function bystanderAnswer(message, guard, choice, face = null) {
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
  const activity = item.system?.activities?.get(guard.activityId) ?? activityOf(item, row);
  const pool = (activity ? poolOf(actor, activity) : null) ?? item;
  if ( row.uses && !(Number(pool?.system?.uses?.value ?? 0) > 0) ) {
    ui.notifications.warn(`${TITLE}: ${guard.name} has no ${pool?.name ?? guard.row} left.`);
    return;
  }
  const roll = message.rolls?.[0];
  const facts = d20FactsOf(roll);
  if ( !roll || !Number.isFinite(facts.kept) ) return;
  // THE TWIST (Beguiling Twist, B2): the roll stands; the pack's Save activity is used at the ONE creature the answerer has
  // targeted — never the roller. Nothing is spent until the aim is right.
  if ( row.bend === "twist" ) {
    const picked = [...game.user.targets];
    const aim = picked[0] ?? null;
    if ( (picked.length !== 1) || !aim?.actor || (aim.actor.uuid === flag.rollerUuid) ) {
      ui.notifications.warn(`${TITLE}: ${guard.row} — target ONE other creature first, then Answer.`);
      // The popup closed with the click (DialogV2); the question is still open — ask it again.
      setTimeout(() => { void showPopup(message, message.getFlag(MODULE_ID, KEY) ?? flag, guard); }, 300);
      return;
    }
    if ( !activity ) {
      ui.notifications.warn(`${TITLE}: ${guard.row} has no ${row.activity ?? "activity"} on ${guard.name} — use it from the sheet.`);
      return;
    }
    if ( row.reaction ) await spendReaction(actor, { origin: item.uuid, what: guard.row });
    const twist = { targetUuid: aim.actor.uuid, targetName: aim.document?.name ?? aim.actor.name };
    await withTargets([aim], () => activity.use({ subsequentActions: false }, { configure: false }, { data: { flags: { [MODULE_ID]: { twistFor: message.id } } } }))
      .catch(err => console.error(`${TITLE} | ${guard.row}'s save could not be demanded — use it from the sheet.`, err));
    return sendAnswer(message, { ...base, answer: "roll", bent: null, twist, poolSpend: null }, actor);
  }
  if ( row.bend === "set" ) {
    const pick = Number.isFinite(Number(face)) ? Number(face) : Number(guard.faces?.[0]);
    if ( !Number.isFinite(pick) || !(await spendStoredFace(actor, row.stored, pick)) ) {
      ui.notifications.warn(`${TITLE}: ${guard.name} no longer holds a ${guard.row} ${pick}.`);
      return;
    }
    const bent = setOutcome({ kept: Number(facts.kept), total: Number(roll.total), face: pick, critAt: 99, fumbleAt: 0 });
    return sendAnswer(message, { ...base, answer: "roll", bent, poolSpend: null }, actor);
  }
  const poolSpend = row.uses ? await spendPoolUses(actor, pool, guard.row, 1, (pool === item) ? null : pool.name)
    .catch(err => { console.warn(`${TITLE} | Could not spend a use for ${guard.row}.`, err); return null; }) : null;
  if ( row.reaction ) await spendReaction(actor, { origin: item.uuid, what: guard.row });
  let bent = null;
  if ( row.bend === "neutralise" ) {
    bent = neutraliseOutcome({ mode: facts.mode, kept: Number(facts.kept), plain: facts.plain, total: Number(roll.total), critAt: 99, fumbleAt: 0, faces: facts.faces });
  } else if ( row.bend === "reroll" ) {
    // THE REROLL (Countercharm): the roller's own d20 rolled again, at Advantage where the row says, in the open; the new
    // roll stands, whatever it shows. The dice rise off the ROLLER, whose save it is.
    const rolled = await rerollD20(roll, resolveUuid(flag.rollerUuid), { advantage: row.advantage === true })
      .catch(err => { console.error(`${TITLE} | ${guard.row}'s reroll failed — reroll the save by hand.`, err); return null; });
    if ( !rolled ) return;
    const newFacts = d20FactsOf(rolled.roll);
    const rise = foldRise({ mode: "reroll", oldFace: facts.kept, newFace: newFacts.kept, total: rolled.summary.total, on: flag.rollerUuid });
    await rolled.roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: resolveUuid(flag.rollerUuid) ?? actor }),
      flavor: `${guard.row} — ${flag.rollerName}'s ${TEST_WORD[flag.testKind] ?? "roll"} rerolled${row.advantage ? " with Advantage" : ""}`,
      flags: { [MODULE_ID]: { respondsTo: message.id, ...(rise ? { diceRise: rise } : {}) } } });
    bent = rerollOutcome({ kept: Number(facts.kept), total: Number(roll.total), newKept: Number(newFacts.kept), newTotal: Number(rolled.summary.total),
      critAt: 99, fumbleAt: 0, faces: newFacts.faces });
  } else {
    let n = 0;
    try {
      const die = await new Roll(String(guard.die)).evaluate();
      await die.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${guard.row} — on ${flag.rollerName}'s ${TEST_WORD[flag.testKind] ?? "roll"}` });
      n = Math.max(0, Number(die.total) || 0);
    } catch(err) {
      console.error(`${TITLE} | ${guard.row}'s die could not be rolled — bend the roll by hand.`, err);
    }
    bent = dieOutcome({ kept: Number(facts.kept), total: Number(roll.total), add: guardSign(guard, row) * n, critAt: 99, fumbleAt: 0 });
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
  if ( row?.bend === "set" ) {
    return `${esc(flag.rollerName)}'s ${test}: <strong>${roll?.total}</strong>${vs}. A stored face replaces the d20 (${facts.kept}) — the modifiers stand.`;
  }
  if ( row?.bend === "twist" ) {
    return `${esc(flag.rollerName)}'s ${test}: <strong>${roll?.total}</strong>${vs} — <strong>it succeeded</strong>. Target ONE other creature `
      + `within ${row.bystander ?? 120} ft of you, then Answer: it makes a Wisdom saving throw against your spell save DC.`;
  }
  if ( row?.bend === "reroll" ) {
    const modifier = Number(roll?.total) - Number(facts.kept);
    return `${esc(flag.rollerName)}'s ${test}: <strong>${roll?.total}</strong>${vs}. The d20 (${facts.kept}) is rolled again`
      + `${row.advantage ? " with Advantage" : ""}; the new roll stands (${modifier < 0 ? "−" : "+"} ${Math.abs(modifier)}, so up to ${20 + modifier}).`;
  }
  if ( row?.bend === "neutralise" ) {
    const o = neutraliseOutcome({ mode: facts.mode, kept: Number(facts.kept), plain: facts.plain, total: Number(roll?.total), critAt: 99, fumbleAt: 0 });
    return `${esc(flag.rollerName)}'s ${test}, rolled with <strong>${facts.mode === "advantage" ? "Advantage" : "Disadvantage"}</strong>: `
      + `${facts.faces.join(" and ")} → <strong>${roll?.total}</strong>${vs}. Take it away and the <strong>first d20 (${o.stood})</strong> stands — <strong>${o.total}</strong>.`;
  }
  const max = Number(dieMaxOf(guard.die)) || 0;
  const minus = guardSign(guard, row) < 0;
  return `${esc(flag.rollerName)}'s ${test}: <strong>${roll?.total}</strong>${vs}.`
    + (Number.isFinite(flag.dc) ? ` A ${esc(guard.die)} can turn it: ${roll?.total} ${minus ? "−" : "+"} ${max} = ${minus ? roll.total - max : roll.total + max}.`
      : " No DC is known — the arithmetic goes on the card and the DM rules.");
}

async function showPopup(message, flag, guard) {
  const actor = resolveUuid(guard.uuid);
  const row = INTERRUPT_ROLLS[guard.row] ?? null;
  const item = actor?.items?.get?.(guard.itemId) ?? null;
  const activity = item ? (item.system?.activities?.get(guard.activityId) ?? (row ? activityOf(item, row) : null)) : null;
  const pool = (activity ? poolOf(actor, activity) : null) ?? item;
  const poolWord = (pool && (pool !== item)) ? `${pool.name} ` : "";
  const tag = [row?.reaction ? "a Reaction" : null, row?.uses ? `${poolWord}${Number(pool?.system?.uses?.value ?? 0)} left` : null].filter(Boolean).join(" · ");
  const dice = (row?.bend === "neutralise") ? "the first d20 stands"
    : (row?.bend === "reroll") ? `reroll${row.advantage ? ", Advantage" : ""}`
      : (row?.bend === "twist") ? "a Wisdom save at your target" : `${guardSign(guard, row) < 0 ? "−" : "+"}${guard.die ?? "a die"}`;
  const test = TEST_WORD[flag.testKind] ?? "roll";
  const self = guard.uuid === flag.rollerUuid;
  const roll = message.rolls?.[0];
  const facts = d20FactsOf(roll);
  const modifier = Number(roll?.total) - Number(facts.kept);
  const rows = (row?.bend === "set")
    ? (guard.faces ?? []).map(face => ({ key: `${guard.row}|${face}`, name: `${guard.row} — replace the ${facts.kept} with the ${face}`,
        dice: `${face} ${modifier < 0 ? "−" : "+"} ${Math.abs(modifier)} = ${face + modifier}`, tag: "a stored die · no Reaction", off: null, rule: row?.rule ?? "" }))
    : [{ key: guard.row, name: guard.row, dice, tag, off: null, rule: row?.rule ?? "" }];
  const dialog = await openMomentPopup(message, `${KEY}|${guard.uuid}`, actor, {
    title: `${guard.row} — ${self ? "your" : `${flag.rollerName}'s`} ${test}`, icon: "fa-solid fa-comment-dots", width: 460,
    content: bfCard({ img: item?.img ?? actor?.img ?? null, eyebrow: `Reaction — ${guard.row}`, tone: "pending",
      title: (row?.bend === "twist") ? `${self ? "You" : flag.rollerName} succeeded on a ${test}` : `${self ? "You rolled" : `${flag.rollerName} rolled`} a ${test}`,
      subtitle: (row?.bystander === "sight") ? "on the scene" : `within ${row?.bystander ?? "?"} ft of you` })
      + holdBarHTML(flag) + `<div style="padding:0.4rem 0.1rem;">${situation(flag, message.rolls?.[0], guard, row)}</div>`
      + tickRowsHTML({ name: "bf-bystander-roll", rows }),
    buttons: [
      { action: "answer", label: "Answer", default: true, callback: (_event, button) => {
        const picked = button?.form?.querySelector?.('input[name="bf-bystander-roll"]:checked');
        if ( !picked ) return;
        void bystanderAnswer(message, guard, "roll", (row?.bend === "set") ? Number(String(picked.value).split("|")[1]) : null);
      } },
      { action: "pass", label: "Pass", callback: () => bystanderAnswer(message, guard, "pass") },
      // Only where a combat runs: out of one there is nothing to mute.
      ...(activeCombatFor(actor) ? [{ action: "mute", label: "Not this combat", callback: () => bystanderAnswer(message, guard, "mute") }] : [])
    ]
  });
  const form = dialog?.element?.querySelector?.("form") ?? dialog?.element ?? null;
  const boxes = [...(form?.querySelectorAll?.('input[name="bf-bystander-roll"]') ?? [])];
  const answer = form?.querySelector?.('button[data-action="answer"]') ?? null;
  if ( boxes[0] ) boxes[0].checked = true;
  for ( const box of boxes ) box.addEventListener("change", () => {
    if ( box.checked ) for ( const other of boxes ) if ( other !== box ) other.checked = false;
    if ( answer ) answer.disabled = !boxes.some(b => b.checked);
  });
}

/** The line a bent check or save carries: who bent it, and the arithmetic (a check's verdict is the DM's). */
function bentLine(flag) {
  const b = flag.bent;
  const who = `${esc(flag.rescue)} (${esc(flag.byName ?? "")})`;
  if ( !b && flag.twist ) return `<strong>${who}</strong> turned it on <strong>${esc(flag.twist.targetName ?? "")}</strong> — a Wisdom saving throw demanded; ${esc(flag.rollerName ?? "the roller")}'s save stands`;
  if ( !b ) return "";
  const change = (b.how === "set") ? `the stored ${b.stood} replaces the d20 (${b.first})`
    : (b.how === "reroll") ? `the d20 (${b.first}) rerolled${(b.faces?.length > 1) ? ` with Advantage (${b.faces.join(", ")})` : ""} — the ${b.stood} stands`
    : (b.how === "neutralised") ? `no Advantage or Disadvantage — the first d20 (${b.stood}) stands`
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
