/**
 * Battle Flow — The shared constants: module id, title, the setting-key map, the setting getter, and the single-writer elect test. A leaf — imports nothing.
 * Split from battleflow.js (design.md §9); battleflow.js is the only esmodules entry.
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
 */
export function queueFlagWrite(message, key, mutate) {
  const lock = `${message.id}|${key}`;
  const run = async () => {
    const current = foundry.utils.deepClone(message.getFlag(MODULE_ID, key) ?? { targets: [] });
    mutate(current);
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

