/**
 * Battle Flow — the shared constants and who/when facts: module id, title, setting keys, the
 * elect and flow-elect tests, combat identity, the deadline roof and the flag-write serializer.
 * A leaf — imports nothing.
 */

export const MODULE_ID = "fvtt-mod-battleflow";
export const TITLE = "Battle Flow";

/** Setting keys. */
export const S = {
  autoDamage: "autoDamage",
  dramaticBeat: "dramaticBeat",
  diceWait: "diceWait",                 // the verdict pause's wait for Dice So Nice
  playerRollDamage: "playerRollDamage",
  effectBar: "effectBar",       // the effect view's bar above the hotbar (client)
  effectHover: "effectHover",   // the effect view's hover card and held key (client)
  measuredCover: "measuredCover", // the 2024 DMG's corner lines: the hover card's Cover section and the attack's AC (world)
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
  noticeTimer: "noticeTimer",
  maneuverFolds: "maneuverFolds",
  d20Folds: "d20Folds",
  d20FoldAsk: "d20FoldAsk",
  volleys: "volleys",
  resourceNotices: "resourceNotices",
  concMode: "concMode",
  concTimer: "concTimer",
  concBreak: "concBreak",
  concVisibility: "concVisibility",
  saves: "saves",
  saveTimer: "saveTimer",
  castApply: "castApply",
  hideCardButtons: "hideCardButtons",
  reminderList: "reminderList",
  conditionList: "conditionList",
  effectList: "effectList",
  clockRiderList: "clockRiderList",
  hitMenuList: "hitMenuList",
  emanations: "emanations",
  emanationList: "emanationList",
  damageShieldList: "damageShieldList",
  damageSaveList: "damageSaveList",
  superiorityUseList: "superiorityUseList",
  effectChoiceList: "effectChoiceList",
  metamagicList: "metamagicList",
  spentAreaList: "spentAreaList",
  chosenAreaList: "chosenAreaList",
  initiativeSwapList: "initiativeSwapList",   // Alert
  healRerollList: "healRerollList",       // Healer
  kitTendList: "kitTendList",             // Healer's Battle Medic on the kit's use
  fightingStyleList: "fightingStyleList", // the fighting styles' faces, gates and numbers
  unarmedDiceList: "unarmedDiceList",     // Tavern Brawler's die on the plain Unarmed Strike
  damageEitherList: "damageEitherList",   // Savage Attacker, Piercer
  tokenLightList: "tokenLightList",        // Inner Radiance and Light
  tokenSenseList: "tokenSenseList",        // Stonecunning
  tokenSizeList: "tokenSizeList",          // Large Form, Enlarge/Reduce
  rebukeList: "rebukeList",                // Storm's Thunder, Hellish Rebuke …
  cardChipList: "cardChipList",            // Tinker
  restGrantList: "restGrantList",          // Resourceful
  dropToOneList: "dropToOneList"           // Relentless Endurance, Death Ward
};

export const setting = key => game.settings.get(MODULE_ID, key);

/** Exactly one client may perform world-visible applications: the active GM's. */
export const isActiveGM = () => game.users.activeGM?.isSelf ?? false;

/**
 * Whose client rolls for this actor: the first active non-GM owner (sorted by id, so every client
 * elects the same one), the active GM otherwise. Only the AUTOMATIC paths consult this; a human
 * pressing Roll is answered by `canAnswerFor`.
 */
export const rollerUserFor = actor => game.users
  .filter(u => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"))
  .sort((a, b) => a.id.localeCompare(b.id))[0] ?? game.users.activeGM;

/* --- THE FLOW ELECT (ARCHITECTURE §4 *The flow elect*) -----------------------------------------
 * Presentation runs without a GM; consequence does not. A player client can create messages and
 * write its own attack message and actor, so every card, ask and popup is reachable; it cannot
 * write an unowned monster, so those consequences are skipped and the driver is told.
 * ⚠ ONE elect, never two: the fallback is the same question with the GM removed, and with a GM
 * active it answers exactly as `isActiveGM()` does.
 * ------------------------------------------------------------------------------------------- */

/**
 * The client that drives world-visible flow for this actor: the active GM, else the actor's own
 * player. Actor-local on purpose: the chain writes to the attack message, which only its author
 * (the attacker's player) may update. Undefined when nobody can drive.
 */
const flowElectFor = actor =>
  game.users.activeGM ?? (actor ? rollerUserFor(actor) : undefined);

/** Is THIS client the flow elect for that actor? Identical to `isActiveGM()` whenever a GM is on. */
const isFlowElectFor = actor => flowElectFor(actor)?.isSelf ?? false;

/**
 * Does THIS client drive a moment whose subject is `subjectUuid`? With a GM on, exactly
 * `isActiveGM()`; with none, the subject's own player — an unresolvable subject drives nothing.
 */
export function drivesMomentFor(subjectUuid) {
  if ( isActiveGM() ) return true;
  if ( game.users.activeGM ) return false;   // a GM is on and it is not us — never two drivers
  const actor = (() => { try { return fromUuidSync(subjectUuid); } catch { return null; } })();
  return !!actor && isFlowElectFor(actor);
}

/**
 * May this client WRITE to that actor (apply an effect, set a condition, move HP)? The guard that
 * turns a silent permission failure into a spoken one.
 */
export const canApplyTo = actor => !!actor?.isOwner;

/**
 * Tell the flow's driver what did NOT happen and what still stands — whispered to self, since it
 * is an operational notice, not a table moment. Best-effort.
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
  // GMs own everything, so they answer only for targets no player owns (the monster side).
  if ( game.user.isGM ) return !game.users.some(u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER"));
  return false;
}

/**
 * Should THIS client drive the continuation? The attack's roller owns it; if that user is offline
 * the active GM takes over so a hold never strands the chain.
 */
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
 * The started combat this actor is in AND that is `game.combat`, or null.
 * ⚠ Not `inRunningCombat`: Foundry measures a `rounds` duration against the ACTIVE combat only,
 * so a round clock chosen off any other combat is born expired (dnd5e files it under Unavailable
 * Effects). ⚠ `getCombatantsByActor` matches a synthetic actor by TOKEN id — an actor-id compare
 * would match an untracked sibling token of the same base actor.
 */
export function activeCombatFor(actor) {
  const combat = game.combat;
  if ( !combat?.started || !actor ) return null;
  return combat.getCombatantsByActor(actor).length ? combat : null;
}

/**
 * WHEN we are, as `${combat.id}:${round}:${turn}`, or null out of combat. The once-per-turn
 * idiom: a stamp is written beside what it governs and any mismatch at read time IS expiry — no
 * timer, no sweep, survives a reload. Out of combat, callers fall back to their own TTL.
 */
export const combatStamp = () => {
  const c = game.combat;
  return c?.started ? `${c.id}:${c.round}:${c.turn}` : null;
};

/**
 * THE DATA-PLANE STAMP (ARCHITECTURE *The data plane*): every consequence carries WHEN
 * (`combat`, null out of combat) and WHO (`sourceUuid`, null when no actor can be named),
 * resolved at write time where both are still live. ⚠ Spread `...statContext(src)` at the write
 * site; never hand-roll it, never stamp post-hoc. Both fields are always present on a stamped
 * record — an absent field marks a record from before the plane.
 */
export const statContext = (sourceUuid = null) => ({ combat: combatStamp(), sourceUuid });

/**
 * The effects the sheet is applying (the system's `appliedEffects`: enabled, unsuppressed, item
 * effects only while equipped/attuned), as plain facts for decide/reminders.js. Each carries its
 * item's name, because the box names the item, not the effect's often-generic name.
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
 * The roll in the table's words ("Wisdom saving throws", "Stealth checks"): the system's labels
 * where it has them, the id otherwise.
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

/* ---------------------------------------------------------------------------------------------
 * THE DEADLINE CEILING. `armDeadline` fires a past deadline on the next tick — right for a reload
 * that ate the window, wrong without a bound: a card left pending is re-armed however old it is,
 * and some buzzers roll dice. ⚠ The bound cannot be a session epoch (session start is
 * per-client, so a reloaded player would refuse every live deadline); an absolute ceiling of ten
 * minutes clears the slowest cold boot.
 * ------------------------------------------------------------------------------------------- */

export const DEADLINE_CEILING_MS = 600_000;

/** Is this deadline still this table's business, or is it history? No deadline ⇒ never arm. */
export const deadlineIsLive = deadline =>
  !!deadline && ((Date.now() - deadline) <= DEADLINE_CEILING_MS);

/* ---------------------------------------------------------------------------------------------
 * SERIALIZED FLAG WRITES — read-modify-write on a message flag with no other writer interleaving.
 * ⚠ Receipt flags are merged, and overlapping merges lose an entry (each clones, merges its own
 * target, and the last setFlag wins) — a lost receipt entry then reads as "not applied yet" and
 * the damage lands twice. Client-local is enough: every write comes from the one elect.
 * ------------------------------------------------------------------------------------------- */

const flagWrites = new Map();

/**
 * Apply `mutate` to `message`'s `key` flag under a per-(message, key) lock; `mutate` gets the
 * current value (deep-cloned, default `{ targets: [] }`) and edits it in place.
 * ⚠ Return `false` to SKIP the write: writers driven from a render hook need it, or they loop
 * write → render → write.
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

