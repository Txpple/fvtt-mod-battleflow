/**
 * Battle Flow — MACHINE layer (ARCHITECTURE.md §2): THE REST GRANTS — a feature whose text gives
 * the creature something "whenever you finish a Long Rest" that the platform does not give it
 * (decide/registry.js REST_GRANTS; Resourceful the first row: Heroic Inspiration). The Human walk,
 * 2026-09-25 (user: "human i think just needs initiatve to be ticked on long rest" — the sheet's
 * Heroic Inspiration box; the pack's own note: "Usage of this feature's activity does not
 * automatically grant Heroic Inspiration").
 *
 * THE SEAM: `dnd5e.preRestCompleted` — the rest's result is computed and its ONE actor update not
 * yet made, so the grant rides that update (`result.updateData`), landing with the hit points and
 * the uses it restores. The rest card then says what was gained (`dnd5e.restCompleted`, the card
 * made; the line reads the stamp).
 *
 * WHERE IT RUNS: the resting client — the rest runs where it was asked (the sheet, the GM's Rest
 * request), and the result is that client's. Nothing is asked: the feature's text grants it.
 */
import { MODULE_ID, TITLE, isActiveGM, queueFlagWrite, canAnswerFor, statContext } from "./core.js";
import { lower, activityNamed, asiAssigned, resolveUuid } from "./lookup.js";
import { listedNames, restGrantEntries } from "./settings.js";
import { bfCard, esc, popupKey, foldedRuleHTML } from "./decide/present.js";
import { REST_GRANTS } from "./decide/registry.js";
import { coatSaveAbility } from "./decide/chips.js";
import { riderPartFormula } from "./decide/clock.js";
import { holdsTemp, mealStanding } from "./decide/rest-grants.js";
import { SURFACES } from "./surfaces.js";
import { nearestFeet, tokenOfActor } from "./geometry.js";
import { isPartyMember } from "./shared.js";
import { livePopups, openMomentPopup, momentButton, shownMoments, registerRelay, registerResumable } from "./ui.js";

/** What a grant writes, by its `grant` word — the sheet facts the table knows how to set. */
const GRANT_WRITES = {
  inspiration: actor => ((actor.type === "character") && (actor.system?.attributes?.inspiration !== true))
    ? { "system.attributes.inspiration": true } : null
};

/** What a grant is called on the card. */
const GRANT_LABEL = { inspiration: "Heroic Inspiration" };

/** The listed rows this actor's sheet holds for this rest, with the write each one makes (nothing already had). */
function grantsFor(actor, restType) {
  const on = listedNames(restGrantEntries());
  const out = [];
  for ( const [name, row] of Object.entries(REST_GRANTS) ) {
    if ( row.to ) continue;   // given to others, asked after the rest (the song, below)
    if ( !on.has(lower(name)) || !row.rests.includes(restType) ) continue;
    if ( !actor.items.some(i => (i.type === "feat") && (lower(i.name) === lower(featureOf(name, row)))) ) continue;
    const write = GRANT_WRITES[row.grant]?.(actor);
    if ( write ) out.push({ name, grant: row.grant, write });
  }
  return out;
}

Hooks.on("dnd5e.preRestCompleted", (actor, result, config) => {
  try {
    if ( !(actor instanceof Actor) || !result?.updateData ) return;
    const grants = grantsFor(actor, result.type ?? config?.type ?? "long");
    if ( !grants.length ) return;
    for ( const g of grants ) foundry.utils.mergeObject(result.updateData, g.write);
    result.bfRestGrants = grants.map(({ name, grant }) => ({ name, grant }));
  } catch(err) {
    console.error(`${TITLE} | Rest grant failed — the rest goes on without it.`, err);
  }
});

// The rest card says what was gained — stamped once the card exists.
Hooks.on("dnd5e.restCompleted", (_actor, result) => {
  const grants = result?.bfRestGrants;
  const message = result?.message;
  if ( !grants?.length || !message?.isOwner ) return;
  void message.setFlag(MODULE_ID, "restGrant", grants)
    .catch(err => console.error(`${TITLE} | Rest grant line failed.`, err));
});

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const grants = message.getFlag(MODULE_ID, "restGrant");
    if ( !grants?.length ) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    const host = root?.querySelector(SURFACES.messageContent);
    if ( !host || host.querySelector("[data-bf-rest-grant]") ) return;
    for ( const g of grants ) {
      const line = document.createElement("div");
      line.setAttribute("data-bf-rest-grant", "");
      line.innerHTML = bfCard({ eyebrow: g.name, tone: "good", title: `${GRANT_LABEL[g.grant] ?? g.grant} gained` });
      host.appendChild(line);
    }
  } catch(err) {
    console.error(`${TITLE} | Rest grant line failed to draw.`, err);
  }
});

/* =============================================================================================
 * THE SONG — a grant GIVEN to allies, asked after the rest (Musician, the origin feats,
 * 2026-09-25; the row's `to: "allies"`). The user: "give a courtesy popup after long and short
 * rest, listing the allies within 30 ft, player picks which ones to give inspiration. grey out
 * the ones that already have and so note it"; "you can leverage the general form of careful
 * spell". Careful Spell's picker is the shape (area-ask.js): ticks grouped Party / Non-Party, the
 * cap enforced as they are made, a tick pinging the creature's token, one OK.
 *
 *   - THE ASK is a card the resting client posts once the rest is done, naming the allies the map
 *     puts within the row's reach (characters on the owner's side, nearest edges — R1; the owner
 *     too where the row says `self`; every one on the scene where the rule names no distance),
 *     each marked with whether it already has the grant. Nobody who could take it: no card.
 *   - THE POPUP opens on whoever answers for the owner (canAnswerFor); no clock — a rest is nobody
 *     else's wait, and the card's button reopens it. The allies without it start ticked, the Party
 *     first, up to the cap (the row's — the owner's Proficiency Bonus for the song).
 *   - THE WRITE is to OTHER actors, so it is the GM's: a GM answering folds directly; a player's
 *     answer is an envelope the elect folds (the relay registry), and the elect lands the picks.
 *     With no GM on, the player is told to give it by hand.
 *
 * THE PHB FEATS, group 5 (2026-09-27 — RULINGS *The PHB feats — groups 4–6*): the same popup gives
 * Temporary Hit Points (Inspiring Leader, Chef's Bolstering Treats — the amount read off the feat's
 * own heal activity, given only where it is more than the creature holds), and Chef's Replenishing
 * Meal: the activity's extra die, healed to an eater that spends Hit Dice in the SAME Short Rest.
 * Each creature rests on its own client in any order, so an eater whose rest already ended is
 * judged off its rest card (the Hit Dice it spent, stamped below) and healed at once; one still
 * resting carries the meal on its sheet (`mealFed`) and is healed as its own rest ends.
 * ========================================================================================== */

const SONG_FLAG = "restSong";
const SPENT_FLAG = "restSpent";   // a Short Rest card's Hit Dice spent (the meal reads it)
const FED_FLAG = "mealFed";       // an eater still resting, carrying the Chef's meal

/** The feature a row is read off — its own name, or the feat it is a benefit of (Chef's two). */
const featureOf = (name, row) => row.feature ?? name;

/** The listed `to: "allies"` rows this actor holds for this rest — `[{ name, row, item }]`. */
function songRowsFor(actor, restType) {
  const on = listedNames(restGrantEntries());
  const out = [];
  for ( const [name, row] of Object.entries(REST_GRANTS) ) {
    if ( (row.to !== "allies") || !on.has(lower(name)) || !row.rests.includes(restType) ) continue;
    const item = actor.items.find(i => (i.type === "feat") && (lower(i.name) === lower(featureOf(name, row))));
    if ( item ) out.push({ name, row, item });
  }
  return out;
}

/**
 * The heal activity a row reads its amount from — the named one, or (Inspiring Leader) the one that
 * stands for the ability the feat raised: its own Ability Score Improvement's record, else the higher
 * modifier among the activities the sheet still carries (the pack: "delete the other").
 */
function grantActivityOf(actor, item, row) {
  if ( row.activity ) return activityNamed(item, row.activity);
  if ( !row.activities ) return null;
  const offered = Object.entries(row.activities).filter(([, n]) => activityNamed(item, n)).map(([a]) => a);
  const ability = coatSaveAbility({ offered, assigned: asiAssigned(item),
    mods: Object.fromEntries(offered.map(a => [a, actor.system?.abilities?.[a]?.mod ?? 0])) });
  return ability ? activityNamed(item, row.activities[ability]) : null;
}

/** A heal activity's amount as a formula, resolved on the owner's sheet — "1d8", "13" — or null (N1). */
function grantFormulaOf(actor, activity) {
  const h = activity?.healing;
  const raw = h ? riderPartFormula({ number: h.number, denomination: h.denomination, custom: h.custom, bonus: h.bonus }) : null;
  try {
    const resolved = raw ? Roll.replaceFormulaData(raw, actor.getRollData()) : null;
    return (resolved && Roll.validate(resolved)) ? resolved : null;
  } catch { return null; }
}

/** The amount a Temporary Hit Points row gives — its formula with no dice, evaluated. */
function tempAmountOf(formula) {
  try { return formula ? Math.max(0, Math.floor(Number(Roll.safeEval(formula)) || 0)) : 0; } catch { return 0; }
}

/** The facts of a creature's latest Short Rest card — its end, the Hit Dice spent, its request — or null. */
function lastShortRestOf(actor) {
  for ( const m of game.messages.contents.slice(-300).reverse() ) {
    if ( (m.type !== "rest") || (m.system?.type !== "short") ) continue;
    const spent = m.getFlag(MODULE_ID, SPENT_FLAG);
    if ( spent?.actorUuid !== actor.uuid ) continue;
    return { at: spent.at ?? m.timestamp, hitDice: spent.hitDice ?? 0, requestId: spent.requestId ?? null };
  }
  return null;
}

/** Whether an actor already holds what the grant gives — the row greyed "(has it)". */
const HAS_GRANT = {
  inspiration: actor => actor?.system?.attributes?.inspiration === true,
  temphp: (actor, flag) => holdsTemp(actor?.system?.attributes?.hp?.temp, flag.amount),
  meal: (_actor, _flag, c) => c.meal === "none"
};

/** What a candidate's row says beside its name, greyed or not. */
function candidateNote(grant, c) {
  if ( grant === "meal" ) return (c.meal === "spent") ? `spent ${c.hitDice} Hit ${c.hitDice === 1 ? "Die" : "Dice"}`
    : (c.meal === "none") ? "spent no Hit Dice" : "still resting — when they spend a Hit Die";
  if ( grant === "temphp" ) return c.has ? `has ${c.temp} temp HP` : (c.temp ? `${c.temp} temp HP now` : "");
  return c.has ? "has it" : "";
}

/** The allies the map puts within reach of the owner's token — characters on its side, one row per actor. */
function songCandidates(actor, row, flag, ownRest = null) {
  const own = tokenOfActor(actor);
  if ( !own ) return [];
  const seen = new Set(row.self ? [] : [actor.uuid]);
  const out = [];
  for ( const t of canvas.tokens?.placeables ?? [] ) {
    const a = t.actor;
    if ( !a || (a.type !== "character") || seen.has(a.uuid) ) continue;
    if ( t.document.disposition !== own.document.disposition ) continue;
    const feet = (a.uuid === actor.uuid) ? 0 : nearestFeet(own, t);
    if ( feet === null ) continue;
    if ( Number.isFinite(row.reach) && (feet > row.reach) ) continue;
    seen.add(a.uuid);
    const c = { uuid: a.uuid, name: t.document.name ?? a.name, tokenId: t.id, feet: Math.round(feet),
      party: isPartyMember(a.uuid), self: a.uuid === actor.uuid };
    if ( row.grant === "temphp" ) c.temp = Number(a.system?.attributes?.hp?.temp) || 0;
    if ( row.grant === "meal" ) {
      const rest = ((a.uuid === actor.uuid) && ownRest) ? ownRest : lastShortRestOf(a);
      c.meal = mealStanding({ rest, chef: { at: flag.restAt, requestId: flag.requestId } });
      c.hitDice = rest?.hitDice ?? 0;
    }
    c.has = !!HAS_GRANT[row.grant]?.(a, flag, c);
    c.note = candidateNote(row.grant, c);
    out.push(c);
  }
  return out.sort((x, y) => (Number(y.party) - Number(x.party)) || (x.feet - y.feet));
}

/** The cap a row names — "prof": the owner's Proficiency Bonus; a number; a formula on the owner's sheet. */
function capOf(actor, row) {
  if ( row.cap === "prof" ) return Math.max(1, Number(actor.system?.attributes?.prof) || 1);
  if ( Number.isFinite(row.cap) ) return Math.max(1, row.cap);
  try { return Math.max(1, Math.floor(Number(Roll.safeEval(Roll.replaceFormulaData(String(row.cap), actor.getRollData()))) || 1)); }
  catch { return 1; }
}

/** What the grant is called on the card and in the popup — the amount where there is one. */
function grantText(flag) {
  if ( flag.grant === "temphp" ) return `${flag.amount} Temporary Hit Points`;
  if ( flag.grant === "meal" ) return `an extra ${flag.formula} Hit Points`;
  return GRANT_LABEL[flag.grant] ?? flag.grant;
}

// Every Short Rest card records the Hit Dice its creature spent (the meal reads it — dnd5e's card
// says it only in its words), on the resting client, which authored the card.
Hooks.on("dnd5e.restCompleted", (actor, result, config) => {
  try {
    const type = result?.type ?? config?.type;
    const message = result?.message;
    if ( (type !== "short") || !(actor instanceof Actor) || !message?.isOwner ) return;
    void message.setFlag(MODULE_ID, SPENT_FLAG, { actorUuid: actor.uuid, hitDice: Math.max(0, -(Number(result.dhd) || 0)),
      requestId: config?.request?.id ?? null, at: Date.now() }).catch(() => {});
  } catch(err) {
    console.warn(`${TITLE} | Could not record the Hit Dice spent in the rest.`, err);
  }
});

Hooks.on("dnd5e.restCompleted", (actor, result, config) => {
  try {
    if ( !(actor instanceof Actor) || !actor.isOwner ) return;
    const restType = result?.type ?? config?.type ?? "long";
    for ( const { name, row, item } of songRowsFor(actor, restType) ) {
      const base = { status: "pending", row: name, grant: row.grant, itemId: item.id, actorUuid: actor.uuid, actorName: actor.name,
        cap: capOf(actor, row), reach: Number.isFinite(row.reach) ? row.reach : null, restAt: Date.now(),
        requestId: config?.request?.id ?? null, ...statContext(actor.uuid) };
      if ( (row.grant === "temphp") || (row.grant === "meal") ) {
        const formula = grantFormulaOf(actor, grantActivityOf(actor, item, row));
        if ( !formula ) {
          console.warn(`${TITLE} | ${name}: its heal activity could not be read off ${actor.name}'s sheet — give it by hand.`);
          continue;
        }
        base.formula = formula;
        if ( row.grant === "temphp" ) {
          base.amount = tempAmountOf(formula);
          if ( !(base.amount > 0) ) continue;
        }
      }
      const ownRest = { at: base.restAt, hitDice: Math.max(0, -(Number(result?.dhd) || 0)), requestId: base.requestId };
      const candidates = songCandidates(actor, row, base, ownRest);
      if ( !candidates.some(c => !c.has) ) continue;   // nobody who could take it
      const flag = { ...base, candidates };
      void ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: bfCard({ img: item.img, eyebrow: name, tone: "pending", title: `${name} — ${grantText(flag)} for allies` }),
        flags: { [MODULE_ID]: { [SONG_FLAG]: flag } }
      }).catch(err => console.error(`${TITLE} | ${name}'s ask could not be posted.`, err));
    }
  } catch(err) {
    console.error(`${TITLE} | The rest song failed — give it by hand.`, err);
  }
});

// THE REST CARD'S OWN ACTIVITY LIST (the walk, 2026-09-27 — Inspiring Leader's card listed "Inspire with
// Wisdom" AND "Inspire with Charisma": "can just say inspiring performance. saying with wis or cha is
// nonsensical"). The pack ships one activity per ability ("delete the other"); the feat raised ONE, and
// the sheet settles which (grantActivityOf). The card keeps that one row, called by the row's `label`.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    if ( message.type !== "rest" ) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    const rows = root?.querySelectorAll?.(SURFACES.cardActivityRow);
    if ( !rows?.length ) return;
    // the rest message's own actor (dnd5e lists ITS activities) — never the speaker's token copy
    const actor = message.system?.actor ?? ChatMessage.getSpeakerActor(message.speaker);
    const restType = message.system?.type;
    if ( !actor || !restType ) return;
    for ( const { row, item } of songRowsFor(actor, restType) ) {
      if ( !row.activities ) continue;
      const kept = grantActivityOf(actor, item, row);
      const others = new Set(Object.values(row.activities).map(n => activityNamed(item, n)?.uuid).filter(u => u && (u !== kept?.uuid)));
      for ( const li of rows ) {
        if ( others.has(li.dataset.activityUuid) ) li.remove();
        else if ( kept && (li.dataset.activityUuid === kept.uuid) && row.label ) {
          const sub = li.querySelector(".subtitle");
          if ( sub ) sub.textContent = row.label;
        }
      }
    }
  } catch(err) {
    console.warn(`${TITLE} | The rest card's activity list could not be trimmed.`, err);
  }
});

/* --- the answer: the GM folds it, a player sends it ---------------------------------------------- */

/** The picks a record allows — the offered allies without the grant, at most the cap. */
function allowedPicks(flag, picks) {
  const allowed = new Set((flag.candidates ?? []).filter(c => !c.has).map(c => c.uuid));
  return [...new Set(picks ?? [])].filter(u => allowed.has(u)).slice(0, flag.cap);
}

async function answerSong(message, picks) {
  const flag = message.getFlag(MODULE_ID, SONG_FLAG);
  if ( flag?.status !== "pending" ) return;
  const chosen = allowedPicks(flag, picks);
  if ( isActiveGM() ) {
    await queueFlagWrite(message, SONG_FLAG, current => {
      if ( current.status !== "pending" ) return false;
      Object.assign(current, { status: "resolved", picks: allowedPicks(current, chosen), answeredAt: Date.now() });
    });
    return;
  }
  if ( !game.users.activeGM ) {
    ui.notifications?.warn(`${flag.row}: a GM must be on to give ${grantText(flag)} — give it on each sheet by hand.`);
    return;
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: resolveUuid(flag.actorUuid) }),
    content: "", whisper: game.users.filter(u => u.isGM).map(u => u.id),
    flags: { [MODULE_ID]: { restSongAnswer: { messageId: message.id, picks: chosen } } }
  });
}

registerRelay("restSongAnswer", {
  flagKey: SONG_FLAG,
  targetOf: a => a.messageId,
  owns: () => isActiveGM(),
  cleanup: true,
  fold: (current, a) => {
    if ( current.status !== "pending" ) return false;
    Object.assign(current, { status: "resolved", picks: allowedPicks(current, a.picks), answeredAt: Date.now() });
  }
});

/** The meal's dice for each eater, rolled on ONE card (the dice show), healed on each sheet. */
async function serveMeal(flag, eaters, { chefName = flag.actorName } = {}) {
  if ( !eaters.length ) return [];
  const rolls = [];
  const served = [];
  for ( const actor of eaters ) {
    const roll = await new Roll(flag.formula).evaluate();
    rolls.push(roll);
    await actor.applyDamage([{ value: roll.total, type: "healing" }]);
    served.push({ name: actor.name, total: roll.total });
  }
  await ChatMessage.create({
    speaker: { alias: chefName }, rolls,
    content: bfCard({ eyebrow: "Replenishing Meal", tone: "good",
      title: served.map(s => `${s.name} +${s.total}`).join(", "),
      subtitle: `${chefName}'s cooking — ${flag.formula} Hit Points each, on top of the Hit Dice spent` })
  });
  return served;
}

/** The elect lands the picks: each sheet written (or, for a meal still waiting, marked), the names written back for the card. */
async function landSong(message) {
  let claimed = false;
  await queueFlagWrite(message, SONG_FLAG, current => {
    if ( (current.status !== "resolved") || current.applied || current.applying ) return false;
    current.applying = true;
    claimed = true;
  });
  if ( !claimed ) return;
  const flag = message.getFlag(MODULE_ID, SONG_FLAG);
  const given = [];
  const waiting = [];
  try {
    const picked = [];
    for ( const uuid of flag.picks ?? [] ) {
      const target = await fromUuid(uuid).catch(() => null);
      if ( target instanceof Actor ) picked.push(target);
    }
    if ( flag.grant === "meal" ) {
      // Judged afresh at the landing — an eater may have finished its rest since the ask.
      const now = [];
      for ( const target of picked ) {
        const standing = mealStanding({ rest: lastShortRestOf(target), chef: { at: flag.restAt, requestId: flag.requestId } });
        if ( standing === "spent" ) now.push(target);
        else if ( standing === "resting" ) {
          await target.setFlag(MODULE_ID, FED_FLAG, { chef: flag.actorName, formula: flag.formula, at: flag.restAt,
            requestId: flag.requestId ?? null, cardId: message.id });
          waiting.push(target.name);
        }
      }
      given.push(...(await serveMeal(flag, now)).map(s => `${s.name} +${s.total}`));
    } else {
      for ( const target of picked ) {
        const write = (flag.grant === "temphp")
          ? (holdsTemp(target.system?.attributes?.hp?.temp, flag.amount) ? null : { "system.attributes.hp.temp": flag.amount })
          : GRANT_WRITES[flag.grant]?.(target);
        if ( write ) await target.update(write);
        // Temporary Hit Points name only those who gained them (a pool that grew since the ask keeps its own).
        if ( write || (flag.grant !== "temphp") ) given.push(flag.candidates.find(c => c.uuid === target.uuid)?.name ?? target.name);
      }
    }
  } catch(err) {
    console.error(`${TITLE} | ${flag.row}'s grant failed part-way — check the sheets.`, err);
  } finally {
    await queueFlagWrite(message, SONG_FLAG, current => {
      current.applied = true; current.applying = false; current.given = given;
      if ( waiting.length ) current.waiting = waiting;
    });
  }
}

registerResumable(SONG_FLAG, {
  pending: flag => (flag?.status === "resolved") && !flag.applied && !flag.applying,
  drives: () => isActiveGM(),
  drive: landSong
});

// An eater that was still resting when the Chef's meal was served: its own rest's end heals it, when it
// spent Hit Dice in that rest — on its own client, which owns the sheet. A meal from another sitting is
// dropped unserved; so is one whose eater spent none.
Hooks.on("dnd5e.restCompleted", (actor, result, config) => {
  try {
    if ( !(actor instanceof Actor) || !actor.isOwner ) return;
    const fed = actor.getFlag(MODULE_ID, FED_FLAG);
    if ( !fed ) return;
    const type = result?.type ?? config?.type;
    const rest = { at: Date.now(), hitDice: Math.max(0, -(Number(result?.dhd) || 0)), requestId: config?.request?.id ?? null };
    const standing = (type === "short") ? mealStanding({ rest, chef: { at: fed.at, requestId: fed.requestId } }) : "none";
    void (async () => {
      await actor.unsetFlag(MODULE_ID, FED_FLAG);
      if ( standing === "spent" ) await serveMeal({ formula: fed.formula, actorName: fed.chef }, [actor]);
    })().catch(err => console.error(`${TITLE} | ${fed.chef}'s meal could not be served — heal ${fed.formula} by hand.`, err));
  } catch(err) {
    console.error(`${TITLE} | The meal at the rest's end failed.`, err);
  }
});

/* --- the popup (Careful Spell's picker) and the card ---------------------------------------------- */

async function showSongPopup(message) {
  const flag = message.getFlag(MODULE_ID, SONG_FLAG);
  if ( flag?.status !== "pending" ) return;
  const actor = resolveUuid(flag.actorUuid);
  if ( !actor ) return;
  const row = REST_GRANTS[flag.row] ?? null;
  const what = grantText(flag);
  // Sorted Party first, nearest first (songCandidates): the first `cap` who lack it start ticked.
  const ticked = new Set(flag.candidates.filter(c => !c.has).slice(0, flag.cap).map(c => c.uuid));
  const note = c => c.note ?? (c.has ? "has it" : "");
  const rowOf = c => `<label style="display:flex;align-items:center;gap:0.4rem;margin:0.2rem 0;${c.has ? "opacity:0.5;" : "cursor:pointer;"}">
      <input type="checkbox" name="bf-rest-song" value="${esc(c.uuid)}" data-token="${esc(c.tokenId ?? "")}" ${c.has ? "data-has=\"1\" disabled" : ""} ${ticked.has(c.uuid) ? "checked" : ""} style="margin:0;">
      <span>${esc(c.name)}${note(c) ? ` <span style="opacity:0.8">(${esc(note(c))})</span>` : ""}</span>
      <span style="margin-left:auto;font-size:var(--font-size-11,11px);opacity:0.7;">${c.self ? "you" : `${c.feet} ft`}</span></label>`;
  const group = (title, list) => list.length ? `<div style="margin:0.3rem 0;"><div style="font-size:var(--font-size-11,11px);letter-spacing:0.08em;text-transform:uppercase;opacity:0.7;margin:0.2rem 0;">${title}</div>${list.map(rowOf).join("")}</div>` : "";
  const party = flag.candidates.filter(c => c.party), others = flag.candidates.filter(c => !c.party);
  const reach = Number.isFinite(flag.reach) ? `within ${flag.reach} ft` : "on the scene";
  const cap = (row?.cap === "prof") ? `up to ${flag.cap} (your Proficiency Bonus)` : `up to ${flag.cap}`;
  const dialog = await openMomentPopup(message, SONG_FLAG, actor, {
    title: `${flag.row} — ${flag.actorName}`, icon: (flag.grant === "inspiration") ? "fa-solid fa-music" : "fa-solid fa-heart", width: 420,
    content: bfCard({ img: actor.items.get(flag.itemId)?.img ?? null, eyebrow: flag.row, tone: "pending",
      title: `Who gets ${what}?`,
      subtitle: `allies ${reach} · ${cap}`,
      lines: [row?.rule ? foldedRuleHTML(esc(row.rule)) : ""] })
      + `<div data-bf-rest-song data-cap="${flag.cap}" style="margin:0.4rem 0;">${group("Party", party)}${group("Non-Party", others)}</div>`,
    buttons: [
      { action: "ok", label: "OK", default: true, callback: (_event, button) => {
        const picks = [...button.form.querySelectorAll('input[name="bf-rest-song"]:checked')].map(i => i.value);
        void answerSong(message, picks);
      } }
    ]
  });
  syncSongCap(dialog?.element?.querySelector?.("[data-bf-rest-song]") ?? null);
}

/** With the cap reached the unticked rows grey; one below it they come back. An ally who has it stays greyed. */
function syncSongCap(box) {
  if ( !box ) return;
  const cap = Number(box.dataset.cap) || 99;
  const boxes = [...box.querySelectorAll('input[name="bf-rest-song"]')].filter(b => !b.dataset.has);
  const on = boxes.filter(b => b.checked).length;
  for ( const b of boxes ) if ( !b.checked ) b.disabled = on >= cap;
}

// A tick pings its creature's token and keeps the cap (Careful's picker, one listener for every popup).
Hooks.once("ready", () => document.addEventListener("change", ev => {
  const input = ev.target?.closest?.('input[name="bf-rest-song"]');
  if ( !input ) return;
  const tok = input.dataset.token ? canvas?.tokens?.get(input.dataset.token) : null;
  if ( input.checked && tok ) { try { canvas.ping(tok.center); } catch { /* no canvas to ping */ } }
  syncSongCap(input.closest("[data-bf-rest-song]"));
}));

/** The card's line — who was given it, or that it waits. */
function songLine(flag) {
  const label = grantText(flag);
  if ( flag.applied ) {
    const given = (flag.given ?? []).length ? `${label} — ${flag.given.join(", ")}` : "";
    const waiting = (flag.waiting ?? []).length ? `still resting: ${flag.waiting.join(", ")} (when they spend a Hit Die)` : "";
    return [given, waiting].filter(Boolean).join(" · ") || "no one was picked";
  }
  if ( flag.status === "resolved" ) return `giving ${label}…`;
  return `asking ${flag.actorName} who gets ${label}`;
}

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, SONG_FLAG);
    if ( !flag ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-rest-song-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-rest-song-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="${(flag.grant === "inspiration") ? "fa-solid fa-music" : "fa-solid fa-heart"}" data-tooltip="${esc(flag.row)}"></i> ${esc(songLine(flag))}`;
    if ( flag.status === "pending" ) {
      const actor = resolveUuid(flag.actorUuid);
      if ( canAnswerFor(actor) ) {
        const shown = popupKey(message.id, SONG_FLAG);
        if ( !shownMoments.has(shown) ) { shownMoments.add(shown); void showSongPopup(message); }
        div.appendChild(momentButton("Answer", () => { void showSongPopup(message); }));
      }
    }
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The rest song line could not render.`, err); }
});

// An answer anywhere closes the popup everywhere (law 4).
Hooks.on("updateChatMessage", message => {
  const flag = message.getFlag(MODULE_ID, SONG_FLAG);
  if ( !flag || (flag.status === "pending") ) return;
  const open = livePopups.get(popupKey(message.id, SONG_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
});
