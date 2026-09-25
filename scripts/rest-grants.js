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
import { lower, resolveUuid } from "./lookup.js";
import { listedNames, restGrantEntries } from "./settings.js";
import { bfCard, esc, popupKey, foldedRuleHTML } from "./decide/present.js";
import { REST_GRANTS } from "./decide/registry.js";
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
    if ( !actor.items.some(i => (i.type === "feat") && (lower(i.name) === lower(name))) ) continue;
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
Hooks.on("dnd5e.restCompleted", (actor, result) => {
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
 *     puts within the row's reach (characters on the owner's side, nearest edges — R1), each marked
 *     with whether it already has the grant. Nobody who could take it: no card.
 *   - THE POPUP opens on whoever answers for the owner (canAnswerFor); no clock — a rest is nobody
 *     else's wait, and the card's button reopens it. The allies without it start ticked, the Party
 *     first, up to the cap (the owner's Proficiency Bonus — the feat's own limit).
 *   - THE WRITE is to OTHER actors, so it is the GM's: a GM answering folds directly; a player's
 *     answer is an envelope the elect folds (the relay registry), and the elect lands the picks.
 *     With no GM on, the player is told to tick the boxes by hand.
 * ========================================================================================== */

const SONG_FLAG = "restSong";

/** The listed `to: "allies"` rows this actor holds for this rest — `[{ name, row, item }]`. */
function songRowsFor(actor, restType) {
  const on = listedNames(restGrantEntries());
  const out = [];
  for ( const [name, row] of Object.entries(REST_GRANTS) ) {
    if ( (row.to !== "allies") || !on.has(lower(name)) || !row.rests.includes(restType) ) continue;
    const item = actor.items.find(i => (i.type === "feat") && (lower(i.name) === lower(name)));
    if ( item ) out.push({ name, row, item });
  }
  return out;
}

/** Whether an actor already holds what the grant gives. */
const HAS_GRANT = { inspiration: actor => actor?.system?.attributes?.inspiration === true };

/** The allies the map puts within reach of the owner's token — characters on its side, one row per actor. */
function songCandidates(actor, row) {
  const own = tokenOfActor(actor);
  if ( !own ) return [];
  const seen = new Set([actor.uuid]);
  const out = [];
  for ( const t of canvas.tokens?.placeables ?? [] ) {
    const a = t.actor;
    if ( !a || (a.type !== "character") || seen.has(a.uuid) ) continue;
    if ( t.document.disposition !== own.document.disposition ) continue;
    const feet = nearestFeet(own, t);
    if ( (feet === null) || (feet > row.reach) ) continue;
    seen.add(a.uuid);
    out.push({ uuid: a.uuid, name: t.document.name ?? a.name, tokenId: t.id, feet: Math.round(feet),
      party: isPartyMember(a.uuid), has: !!HAS_GRANT[row.grant]?.(a) });
  }
  return out.sort((x, y) => (Number(y.party) - Number(x.party)) || (x.feet - y.feet));
}

/** The cap a row names — "prof": the owner's Proficiency Bonus. */
const capOf = (actor, row) => (row.cap === "prof") ? Math.max(1, Number(actor.system?.attributes?.prof) || 1) : (Number(row.cap) || 1);

Hooks.on("dnd5e.restCompleted", (actor, result, config) => {
  try {
    if ( !(actor instanceof Actor) || !actor.isOwner ) return;
    for ( const { name, row, item } of songRowsFor(actor, result?.type ?? config?.type ?? "long") ) {
      const candidates = songCandidates(actor, row);
      if ( !candidates.some(c => !c.has) ) continue;   // nobody who could take it
      void ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: bfCard({ img: item.img, eyebrow: name, tone: "pending", title: `${name} — ${GRANT_LABEL[row.grant] ?? row.grant} for allies` }),
        flags: { [MODULE_ID]: { [SONG_FLAG]: {
          status: "pending", row: name, grant: row.grant, itemId: item.id, actorUuid: actor.uuid, actorName: actor.name,
          cap: capOf(actor, row), reach: row.reach, candidates, ...statContext(actor.uuid)
        } } }
      }).catch(err => console.error(`${TITLE} | ${name}'s ask could not be posted.`, err));
    }
  } catch(err) {
    console.error(`${TITLE} | The rest song failed — give it by hand.`, err);
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
    ui.notifications?.warn(`${flag.row}: a GM must be on to give ${GRANT_LABEL[flag.grant] ?? flag.grant} — tick it on each sheet by hand.`);
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

/** The elect lands the picks: each sheet's box ticked, the names written back for the card. */
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
  try {
    for ( const uuid of flag.picks ?? [] ) {
      const target = await fromUuid(uuid).catch(() => null);
      if ( !(target instanceof Actor) ) continue;
      const write = GRANT_WRITES[flag.grant]?.(target);
      if ( write ) await target.update(write);
      given.push(flag.candidates.find(c => c.uuid === uuid)?.name ?? target.name);
    }
  } catch(err) {
    console.error(`${TITLE} | ${flag.row}'s grant failed part-way — check the sheets.`, err);
  } finally {
    await queueFlagWrite(message, SONG_FLAG, current => { current.applied = true; current.applying = false; current.given = given; });
  }
}

registerResumable(SONG_FLAG, {
  pending: flag => (flag?.status === "resolved") && !flag.applied && !flag.applying,
  drives: () => isActiveGM(),
  drive: landSong
});

/* --- the popup (Careful Spell's picker) and the card ---------------------------------------------- */

async function showSongPopup(message) {
  const flag = message.getFlag(MODULE_ID, SONG_FLAG);
  if ( flag?.status !== "pending" ) return;
  const actor = resolveUuid(flag.actorUuid);
  if ( !actor ) return;
  const row = REST_GRANTS[flag.row] ?? null;
  const label = GRANT_LABEL[flag.grant] ?? flag.grant;
  // Sorted Party first, nearest first (songCandidates): the first `cap` who lack it start ticked.
  const ticked = new Set(flag.candidates.filter(c => !c.has).slice(0, flag.cap).map(c => c.uuid));
  const rowOf = c => `<label style="display:flex;align-items:center;gap:0.4rem;margin:0.2rem 0;${c.has ? "opacity:0.5;" : "cursor:pointer;"}">
      <input type="checkbox" name="bf-rest-song" value="${esc(c.uuid)}" data-token="${esc(c.tokenId ?? "")}" ${c.has ? "data-has=\"1\" disabled" : ""} ${ticked.has(c.uuid) ? "checked" : ""} style="margin:0;">
      <span>${esc(c.name)}${c.has ? ` <span style="opacity:0.8">(already has ${esc(label)})</span>` : ""}</span>
      <span style="margin-left:auto;font-size:var(--font-size-11,11px);opacity:0.7;">${c.feet} ft</span></label>`;
  const group = (title, list) => list.length ? `<div style="margin:0.3rem 0;"><div style="font-size:var(--font-size-11,11px);letter-spacing:0.08em;text-transform:uppercase;opacity:0.7;margin:0.2rem 0;">${title}</div>${list.map(rowOf).join("")}</div>` : "";
  const party = flag.candidates.filter(c => c.party), others = flag.candidates.filter(c => !c.party);
  const dialog = await openMomentPopup(message, SONG_FLAG, actor, {
    title: `${flag.row} — ${flag.actorName}`, icon: "fa-solid fa-music", width: 420,
    content: bfCard({ img: actor.items.get(flag.itemId)?.img ?? null, eyebrow: flag.row, tone: "pending",
      title: `Who gets ${label}?`,
      subtitle: `allies within ${flag.reach} ft · up to ${flag.cap} (your Proficiency Bonus)`,
      lines: [row?.rule ? foldedRuleHTML(esc(row.rule)) : ""] })
      + `<div data-bf-rest-song data-cap="${flag.cap}" style="margin:0.4rem 0;">${group("Party", party)}${group("Non-Party", others)}</div>`,
    buttons: [
      { action: "ok", label: "OK", default: true, callback: (event, button) => {
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
  const label = GRANT_LABEL[flag.grant] ?? flag.grant;
  if ( flag.applied ) return (flag.given ?? []).length ? `${label} given to ${flag.given.join(", ")}` : "no one was picked";
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
    div.innerHTML = `<i class="fa-solid fa-music" data-tooltip="${esc(flag.row)}"></i> ${esc(songLine(flag))}`;
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
