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
  autoApply: "autoApply",
  requireTarget: "requireTarget",
  suppressAttackCards: "suppressAttackCards",
  suppressWeaponCards: "suppressWeaponCards",
  suppressSpellCards: "suppressSpellCards",
  suppressFeatureCards: "suppressFeatureCards",
  suppressOtherCards: "suppressOtherCards",
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

