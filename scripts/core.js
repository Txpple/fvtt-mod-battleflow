/**
 * Battle Flow — The shared constants: module id, title, the setting-key map, the setting getter, and the single-writer elect test. A leaf — imports nothing.
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */

export const MODULE_ID = "fvtt-mod-battleflow";
export const TITLE = "Battle Flow";

/** Setting keys. */
export const S = {
  autoDamage: "autoDamage",
  dramaticBeat: "dramaticBeat",
  playerRollDamage: "playerRollDamage",
  damageTimer: "damageTimer",
  autoApply: "autoApply",
  requireTarget: "requireTarget",
  centerRollDialogs: "centerRollDialogs",
  reactionHold: "reactionHold",
  interruptList: "interruptList",
  blockList: "blockList",
  holdReveal: "holdReveal",
  holdTimer: "holdTimer",
  holdSkipFutile: "holdSkipFutile",
  holdSettle: "holdSettle",
  holdApplyEffect: "holdApplyEffect",
  riders: "riders",
  riderList: "riderList",
  riderUpgrades: "riderUpgrades",
  effectRiders: "effectRiders",
  masteryRiders: "masteryRiders",
  masteryAsk: "masteryAsk",
  maneuverFolds: "maneuverFolds",
  volleys: "volleys",
  resourceNotices: "resourceNotices",
  concMode: "concMode",
  concTimer: "concTimer",
  concBreak: "concBreak",
  concVisibility: "concVisibility",
  saves: "saves",
  saveTimer: "saveTimer",
  castApply: "castApply",
  hideCardButtons: "hideCardButtons"
};

export const setting = key => game.settings.get(MODULE_ID, key);

/** Exactly one client may perform world-visible applications: the active GM's. */
export const isActiveGM = () => game.users.activeGM?.isSelf ?? false;

/**
 * Whose client rolls for this actor: the first active non-GM owner (their character, their
 * dice), the active-GM elect otherwise. Deterministic on every client — same sorted user list,
 * so every client elects the same roller without anyone coordinating.
 *
 * ⚠ Only the AUTOMATIC paths consult this — auto mode's volunteer, and nobody for the buzzer,
 * which the elect owns. A human pressing Roll is answered by `canAnswerFor`, like every other
 * surface. (Was copied verbatim in concentration.js and saves.js; saves.js's own comment
 * called it "the concentration election", which is a duplicate announcing itself.)
 */
export const rollerUserFor = actor => game.users
  .filter(u => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"))
  .sort((a, b) => a.id.localeCompare(b.id))[0] ?? game.users.activeGM;

/* ---------------------------------------------------------------------------------------------
 * THE DEADLINE CEILING — the moment clocks have a floor and need a roof.
 *
 * `armDeadline` (ui.js) arms with `Math.max(0, deadline - Date.now())`, so a deadline already in
 * the past fires on the NEXT TICK. That is correct for a window the table just missed: a client
 * that F5s mid-moment is MEANT to resume and let the buzzer land (the volley popup's reload
 * behaviour is specified that way — the even spread fires on reload rather than stranding).
 *
 * It is wrong without a bound. A card left `status: "pending"` in the world is re-armed by the
 * elect's next render however old it is, and two of the five buzzers ACT rather than pass:
 * `fireSaveTimer` rolls saves for every unanswered target, `fireConcTimer` rolls the
 * concentration save. A demand from a fight that ended months ago would roll dice the instant
 * somebody opened the world — the module deciding where a human never did.
 *
 * ⚠ The bound CANNOT be a session epoch, though that is the tempting shape. Session start is
 * per-CLIENT, so an F5'd player's own reload would read every still-live deadline as some other
 * session's history and refuse it — killing precisely the resume the design asks for. An
 * absolute staleness ceiling makes the only distinction that matters: seconds-to-minutes stale
 * is a reload that ate the window (fire), and past that the table has moved on (never fire).
 * Ten minutes clears the widest measured cold boot (a cold Molten start has needed ~540s of
 * headroom) with room to spare.
 * ------------------------------------------------------------------------------------------- */

export const DEADLINE_CEILING_MS = 600_000;

/** Is this deadline still this table's business, or is it history? No deadline ⇒ never arm. */
export const deadlineIsLive = deadline =>
  !!deadline && ((Date.now() - deadline) <= DEADLINE_CEILING_MS);

/* ---------------------------------------------------------------------------------------------
 * SERIALIZED FLAG WRITES — read-modify-write on a message flag, with no other writer interleaving.
 *
 * ⚠ THIS EXISTS BECAUSE OF A MEASURED BUG (2026-08-20), not as a precaution. Both receipt flags
 * are merged rather than overwritten, because one roll's application can be split across time
 * (v1.6.0's spell hold). That merge is correct when the writes are sequential and WRONG when
 * they overlap: each writer deep-clones the flag, merges only its own target, and the last
 * setFlag lands without the other's entry.
 *
 * The save slice makes them overlap by design — per-target independence means two targets'
 * consequence passes run at once against one card. The lost entry is two faults at once: the
 * card under-reports who took damage, and `reconcileSaveDamage` uses the receipt as its
 * idempotence guard, so a missing entry reads as "not applied yet" and the damage lands on that
 * target a SECOND time. Measured at three applyDamage calls for two targets, a flat-10 spell
 * taking 20 off the failed save, and a receipt naming only the target that saved.
 *
 * Client-local is sufficient: every write comes from the one elect (isActiveGM).
 * ------------------------------------------------------------------------------------------- */

const flagWrites = new Map();

/**
 * Apply `mutate` to `message`'s `key` flag under a per-(message, key) lock. `mutate` receives the
 * current value (deep-cloned, defaulting to `{ targets: [] }`) and mutates it in place.
 *
 * ⚠ Return `false` from `mutate` to SKIP the write entirely. Some writers are driven from the
 * render hook, where an unconditional write is a write → render → write loop; their "nothing
 * changed, write nothing" guard is loop protection, not tidiness, and it has to survive the
 * move onto the serializer. Any other return value (including undefined) writes as normal.
 */
export function queueFlagWrite(message, key, mutate) {
  const lock = `${message.id}|${key}`;
  const run = async () => {
    const current = foundry.utils.deepClone(message.getFlag(MODULE_ID, key) ?? { targets: [] });
    if ( mutate(current) === false ) return;
    await message.setFlag(MODULE_ID, key, current);
  };
  // `.then(run, run)` on purpose: one write failing must not strand every write queued behind it.
  const prior = flagWrites.get(lock) ?? Promise.resolve();
  const next = prior.then(run, run);
  const tail = next.catch(() => {});  // the STORED link never rejects, so the chain cannot break
  flagWrites.set(lock, tail);
  void tail.then(() => { if ( flagWrites.get(lock) === tail ) flagWrites.delete(lock); });
  return next;                        // the CALLER still sees a failure, and logs it as before
}

