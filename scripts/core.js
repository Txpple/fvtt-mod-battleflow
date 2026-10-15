/**
 * By the Books — shared constants and who/when facts: setting keys, the elects, combat identity, the
 * deadline ceiling and the flag-write serializer. A leaf — imports nothing.
 */

export const MODULE_ID = "fvtt-mod-bythebooks";
/** The package id before 3.0.0 (formerly Battle Flow): the flag scope old documents still carry. */
export const LEGACY_ID = "fvtt-mod-battleflow";
// The `data-bf-*` DOM anchors predate the rename and stay: cards posted before 3.0.0 carry them in their stored HTML.
export const TITLE = "By the Books";

/**
 * Publish one of the module's public hooks (`bythebooks.<name>`). 3.0.x also fired each under its
 * Battle Flow name (`battleflow.<name>`) so readers could move on their own schedule; 3.1.0 stopped
 * (issue #14), once FX Studio 0.9.0 listened to the new names.
 * @param {string} name  the hook's name after the prefix
 * @param {...any} args
 */
export function publish(name, ...args) {
  Hooks.callAll(`bythebooks.${name}`, ...args);
}

/**
 * Read one of the module's own flags: the new scope, else the legacy one. FOR GOOD: old chat cards
 * keep their old-scope flags forever (the migration skips messages). ⚠ The legacy scope is read as a
 * plain property on purpose: `getFlag(LEGACY_ID, …)` throws once the old package is uninstalled.
 * @param {any} doc
 * @param {string} key
 */
export const readFlag = (doc, key) => doc?.getFlag?.(MODULE_ID, key) ?? doc?.flags?.[LEGACY_ID]?.[key];

/**
 * Remove one of the module's own flags from a document the migration never touches (a chat card): the
 * new scope's key, and the legacy scope's too when it holds one, so `readFlag` cannot read it back.
 * @param {any} doc
 * @param {string} key
 * @param {object} [options]
 */
export function clearFlag(doc, key, options = {}) {
  const update = { [`flags.${MODULE_ID}.-=${key}`]: null };
  const legacy = doc?.flags?.[LEGACY_ID];
  if ( legacy && (typeof legacy === "object") && (key in legacy) ) update[`flags.${LEGACY_ID}.-=${key}`] = null;
  return doc.update(update, options);
}

export const S = {
  decisionTimer: "decisionTimer",       // every question's clock
  dramaticBeat: "dramaticBeat",
  saveRolls: "saveRolls",               // demanded saves and concentration: prompt or roll automatically
  concVisibility: "concVisibility",
  holdReveal: "holdReveal",
  masteryAsk: "masteryAsk",
  resourceNotices: "resourceNotices",
  rollResults: "rollResults",           // owns dnd5e's attack and challenge visibility
  bloodiedAll: "bloodiedAll",           // owns dnd5e's bloodied visibility
  playerRollDamage: "playerRollDamage", // client
  effectBar: "effectBar",               // client: the effect view's bar above the hotbar
  effectHover: "effectHover",           // client: the effect view's hover card and held key
  goingDownCosts: "goingDownCosts",     // world: a house rule — a level of Exhaustion at the drop to 0 HP (off by default)
  summonArt: "summonArt",               // world, hidden: the summon art window's table (summon-art.js)
  formArt: "formArt"                    // world, hidden: the Wild Shape art window's table (summon-art.js)
};

export const setting = key => game.settings.get(MODULE_ID, key);

/** The Decision Timer in seconds; 0 waits indefinitely. */
export const decisionWindow = () => Math.max(0, Number(setting(S.decisionTimer)) || 0);

/** Do demanded saves and concentration checks roll without a popup? */
export const savesRollThemselves = () => setting(S.saveRolls) === "auto";

/** Seconds, at most, a verdict waits for Dice So Nice's dice to come to rest. */
export const DICE_WAIT_SECONDS = 4;

/** Seconds a cast reaction's AC change is given to land before the attack is re-tested. */
export const HOLD_SETTLE_SECONDS = 8;

/**
 * THE LEADING WINDOW. One user may have the game open in two windows, and each is a client: both would
 * see `activeGM.isSelf` and both would land every consequence (two familiars, every damage twice). This
 * window's id, and the flag on its User naming the window that leads (the one loaded or focused last; ui.js
 * claims it). No flag: this window leads.
 */
export const WINDOW_ID = Math.random().toString(36).slice(2, 14);   // no Foundry at import: the tools load this file
export const LEAD_FLAG = "leadWindow";
export const leadsWindow = () => {
  const lead = game.user?.flags?.[MODULE_ID]?.[LEAD_FLAG] ?? null;
  return !lead || (lead === WINDOW_ID);
};

/** Exactly one client may perform world-visible applications: the active GM's, in its leading window. */
export const isActiveGM = () => (game.users.activeGM?.isSelf ?? false) && leadsWindow();

/** Whose client auto-rolls for this actor: the first active non-GM owner by id, else the active GM. */
export const rollerUserFor = actor => game.users
  .filter(u => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"))
  .sort((a, b) => a.id.localeCompare(b.id))[0] ?? game.users.activeGM;

// THE FLOW ELECT (ARCHITECTURE §4 *The flow elect*): the active GM, else the actor's own player.
// ⚠ ONE elect, never two: with a GM on it answers exactly as `isActiveGM()`.

const flowElectFor = actor =>
  game.users.activeGM ?? (actor ? rollerUserFor(actor) : undefined);

const isFlowElectFor = actor => (flowElectFor(actor)?.isSelf ?? false) && leadsWindow();

/** Does THIS client drive a moment whose subject is `subjectUuid`? */
export function drivesMomentFor(subjectUuid) {
  if ( isActiveGM() ) return true;
  if ( game.users.activeGM ) return false;
  const actor = (() => { try { return fromUuidSync(subjectUuid); } catch { return null; } })();
  return !!actor && isFlowElectFor(actor);
}

/** May this client WRITE to that actor? Turns a silent permission failure into a spoken one. */
export const canApplyTo = actor => !!actor?.isOwner;

/**
 * Whisper to self what did NOT happen for lack of a GM, and what still stands.
 * @param {string} what
 * @param {string|null} [stands]
 */
export async function whisperNoGM(what, stands = null) {
  try {
    await ChatMessage.create({
      whisper: [game.user.id],
      speaker: { alias: TITLE },
      content: `<p><strong>No GM is connected</strong>, so ${what} was not applied.`
        + `${stands ? ` ${stands}` : ""}</p>`
    });
  } catch(err) {
    console.warn(`${TITLE} | Could not post the no-GM notice.`, err);
  }
}

/** Everyone who may answer for a held target: its owners, or the GM for unowned NPCs. */
export function canAnswerFor(actor) {
  if ( !actor ) return false;
  if ( actor.isOwner && !game.user.isGM ) return true;
  // A GM answers only where no active player owns the actor.
  if ( game.user.isGM ) return !game.users.some(u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER"));
  return false;
}

/**
 * Does THIS client answer a moment its user started (a summon or a transform cast from a sheet)? The
 * user who cast it, in their leading window, while they are connected — a GM casting for a player's
 * character answers on the GM's screen; with that user gone, whoever `canAnswerFor` the actor.
 * @param {string|null|undefined} userId   who started it (a User id)
 * @param {Actor|null} actor
 */
export function answersHere(userId, actor) {
  const by = userId ? game.users.get(userId) : null;
  if ( by?.active ) return by.isSelf && leadsWindow();
  return canAnswerFor(actor);
}

/** Does THIS client drive the continuation? The roller, or the active GM when they are offline. */
export function isContinuingClient(hold) {
  const owner = game.users.get(hold?.continuedBy);
  return owner?.active ? (owner.isSelf && leadsWindow()) : isActiveGM();
}

/** Does THIS client keep a card — its author while connected, else the active GM? ONE client answers yes. */
export const keepsMessage = message =>
  !!message && (message.isAuthor || (!message.author?.active && isActiveGM()));

/** Is this actor a combatant in any started combat? ⚠ Matched the platform's way (see `activeCombatFor`). */
export function inRunningCombat(actor) {
  if ( !actor ) return false;
  return game.combats.some(c => c.started && c.getCombatantsByActor(actor).length);
}

/**
 * `game.combat` if started and this actor is in it, else null. ⚠ A `rounds` duration off any other
 * combat is born expired. ⚠ `getCombatantsByActor` matches synthetic actors by TOKEN, not actor id.
 */
export function activeCombatFor(actor) {
  const combat = game.combat;
  if ( !combat?.started || !actor ) return null;
  return combat.getCombatantsByActor(actor).length ? combat : null;
}

/**
 * `${combat.id}:${round}:${turn}`, or null out of combat. Once-per-turn: a mismatch at read time IS
 * expiry — no timer, no sweep.
 */
export const combatStamp = () => {
  const c = game.combat;
  return c?.started ? `${c.id}:${c.round}:${c.turn}` : null;
};

/**
 * THE DATA-PLANE STAMP (ARCHITECTURE *The data plane*): WHEN and WHO on every consequence.
 * ⚠ Spread `...statContext(src)` at the write site; never hand-roll it or stamp post-hoc.
 */
export const statContext = (sourceUuid = null) => ({ combat: combatStamp(), sourceUuid });

/**
 * The sheet's `appliedEffects` as plain facts, each with its item's name (the box names the item).
 * @param {Actor} actor
 * @returns {{id: string, name: string, item: string|null, changes: {key: string, value: string}[]}[]}
 */
export function sheetModeEffects(actor) {
  return (actor?.appliedEffects ?? []).map(e => ({
    id: e.id, name: e.name,
    item: (e.parent instanceof Item) ? e.parent.name : null,
    changes: (e.changes ?? []).map(({ key, value }) => ({ key, value }))
  }));
}

/**
 * The roll in the table's words ("Wisdom saving throws", "Stealth checks").
 * @param {{kind: "save"|"check", ability?: string|null, skill?: string|null, tool?: string|null, concentration?: boolean}} roll
 */
export function rollLabelFor({ kind, ability = null, skill = null, tool = null, concentration = false }) {
  const abl = ability ? (CONFIG.DND5E?.abilities?.[ability]?.label ?? ability) : null;
  if ( (kind === "save") && concentration ) return "saving throws to maintain Concentration";
  if ( kind === "save" ) return `${abl ?? "these"} saving throws`;
  if ( skill ) return `${CONFIG.DND5E?.skills?.[skill]?.label ?? skill} checks`;
  if ( tool ) {
    let label = tool;
    try { label = dnd5e.documents.Trait.keyLabel(tool, { trait: "tool" }) || tool; } catch { /* the id */ }
    return `${label} checks`;
  }
  return `${abl ?? "these"} checks`;
}

// THE DEADLINE CEILING: a past deadline fires at once, and some buzzers roll dice, so an old card
// must not re-arm. ⚠ Absolute, not a session epoch (per-client); ten minutes clears a cold boot.
export const DEADLINE_CEILING_MS = 600_000;

/** No deadline ⇒ never arm. */
export const deadlineIsLive = deadline =>
  !!deadline && ((Date.now() - deadline) <= DEADLINE_CEILING_MS);

/**
 * `setFlag` MERGES: a key a mutate callback deleted stays stored unless the write carries the
 * platform's `"-=key": null`. Objects recurse; an array is a value and is replaced whole.
 * @template {object} T
 * @param {any} before  the stored flag
 * @param {T} after     the mutated clone, marked in place
 * @returns {T}
 */
export function markDeletions(before, after) {
  const plain = v => (v !== null) && (typeof v === "object") && !Array.isArray(v);
  if ( !plain(before) || !plain(after) ) return after;
  for ( const k of Object.keys(before) ) {
    if ( !(k in after) ) after[`-=${k}`] = null;
    else markDeletions(before[k], after[k]);
  }
  return after;
}

// SERIALIZED FLAG WRITES. ⚠ Overlapping merges lose an entry (last setFlag wins), and a lost
// receipt entry lands the damage twice. Client-local suffices: every write comes from the elect.

const flagWrites = new Map();

/**
 * Edit `message`'s `key` flag in place (deep clone) under a lock; any document with flags will do.
 * `initial` is the flag's shape when the document has none yet (default `{ targets: [] }`; `[]` for
 * a list, `{}` for a map). ⚠ Return `false` to SKIP the write, or a render-hook writer loops.
 * @param {any} message
 * @param {string} key
 * @param {(current: any) => (void|boolean)} mutate
 * @param {{ initial?: any }} [opts]
 */
export function queueFlagWrite(message, key, mutate, { initial = { targets: [] } } = {}) {
  const lock = `${message.id}|${key}`;
  const run = async () => {
    const before = readFlag(message, key) ?? initial;
    const current = foundry.utils.deepClone(before);
    if ( mutate(current) === false ) return;
    await message.setFlag(MODULE_ID, key, markDeletions(before, current));
  };
  // `.then(run, run)`: one failure must not strand the writes behind it.
  const prior = flagWrites.get(lock) ?? Promise.resolve();
  const next = prior.then(run, run);
  const tail = next.catch(() => {});  // the stored link never rejects
  flagWrites.set(lock, tail);
  void tail.then(() => { if ( flagWrites.get(lock) === tail ) flagWrites.delete(lock); });
  return next;                        // the caller still sees a failure
}

