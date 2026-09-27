/**
 * Battle Flow — shared constants and who/when facts: setting keys, the elects, combat identity, the
 * deadline ceiling and the flag-write serializer. A leaf — imports nothing.
 */

export const MODULE_ID = "fvtt-mod-battleflow";
export const TITLE = "Battle Flow";

export const S = {
  decisionTimer: "decisionTimer",       // every question's clock
  dramaticBeat: "dramaticBeat",
  saveRolls: "saveRolls",               // demanded saves and concentration: prompt or roll automatically
  concVisibility: "concVisibility",
  holdReveal: "holdReveal",
  masteryAsk: "masteryAsk",
  resourceNotices: "resourceNotices",
  playerRollDamage: "playerRollDamage", // client
  effectBar: "effectBar",               // client: the effect view's bar above the hotbar
  effectHover: "effectHover"            // client: the effect view's hover card and held key
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

/** Exactly one client may perform world-visible applications: the active GM's. */
export const isActiveGM = () => game.users.activeGM?.isSelf ?? false;

/** Whose client auto-rolls for this actor: the first active non-GM owner by id, else the active GM. */
export const rollerUserFor = actor => game.users
  .filter(u => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"))
  .sort((a, b) => a.id.localeCompare(b.id))[0] ?? game.users.activeGM;

// THE FLOW ELECT (ARCHITECTURE §4 *The flow elect*): the active GM, else the actor's own player.
// ⚠ ONE elect, never two: with a GM on it answers exactly as `isActiveGM()`.

const flowElectFor = actor =>
  game.users.activeGM ?? (actor ? rollerUserFor(actor) : undefined);

const isFlowElectFor = actor => flowElectFor(actor)?.isSelf ?? false;

/** Does THIS client drive a moment whose subject is `subjectUuid`? */
export function drivesMomentFor(subjectUuid) {
  if ( isActiveGM() ) return true;
  if ( game.users.activeGM ) return false;
  const actor = (() => { try { return fromUuidSync(subjectUuid); } catch { return null; } })();
  return !!actor && isFlowElectFor(actor);
}

/** May this client WRITE to that actor? Turns a silent permission failure into a spoken one. */
export const canApplyTo = actor => !!actor?.isOwner;

/** Whisper to self what did NOT happen for lack of a GM, and what still stands. */
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

/** Does THIS client drive the continuation? The roller, or the active GM when they are offline. */
export function isContinuingClient(hold) {
  const owner = game.users.get(hold?.continuedBy);
  return owner?.active ? owner.isSelf : isActiveGM();
}

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

// SERIALIZED FLAG WRITES. ⚠ Overlapping merges lose an entry (last setFlag wins), and a lost
// receipt entry lands the damage twice. Client-local suffices: every write comes from the elect.

const flagWrites = new Map();

/**
 * Edit `message`'s `key` flag in place (deep clone, default `{ targets: [] }`) under a lock.
 * ⚠ Return `false` to SKIP the write, or a render-hook writer loops.
 */
export function queueFlagWrite(message, key, mutate) {
  const lock = `${message.id}|${key}`;
  const run = async () => {
    const current = foundry.utils.deepClone(message.getFlag(MODULE_ID, key) ?? { targets: [] });
    if ( mutate(current) === false ) return;
    await message.setFlag(MODULE_ID, key, current);
  };
  // `.then(run, run)`: one failure must not strand the writes behind it.
  const prior = flagWrites.get(lock) ?? Promise.resolve();
  const next = prior.then(run, run);
  const tail = next.catch(() => {});  // the stored link never rejects
  flagWrites.set(lock, tail);
  void tail.then(() => { if ( flagWrites.get(lock) === tail ) flagWrites.delete(lock); });
  return next;                        // the caller still sees a failure
}

