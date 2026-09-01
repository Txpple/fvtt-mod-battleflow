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
  conditionList: "conditionList"
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

/* --- THE FLOW ELECT: the machines keep running when the GM drops (v1.27.0, user call) --------
 * `isActiveGM()` was the ONLY gate on the payout chain, so a GM disconnect stopped Battle Flow
 * dead — no chip, no card, no popup, and **no error**. The table read that as the module being
 * flaky; nobody was ever told the reason. The user's ruling: the popups all run WITHOUT a GM,
 * the effects that need GM permission simply do not apply, and whoever is running the flow is
 * TOLD which consequence was skipped.
 *
 * The split the code actually falls along is presentation vs consequence. A player client may
 * create chat messages, write flags on their OWN attack message, and write flags on their own
 * actor — so every card, ask and popup is reachable. It may NOT create an ActiveEffect on an
 * unowned monster, toggle its Prone, or change its HP — so every consequence is not.
 *
 * ⚠ ONE elect, never two. This module has been bitten more than once by two clients both
 * believing they own a moment (the twin-ask supersede in mastery.js is the scar), so the
 * fallback is not a second election running beside the first: it is the SAME question with the
 * GM removed from the answer. With a GM active this returns exactly what `isActiveGM()` did.
 * ------------------------------------------------------------------------------------------- */

/**
 * The client that drives world-visible flow FOR THIS ACTOR: the active GM, and with no GM
 * connected the actor's own player (their swing, their client). Actor-local rather than a
 * room-wide fallback on purpose — the chain's writes land on the ATTACK MESSAGE, which only
 * its author may update, and its author is the attacker's player. A room-wide "lowest active
 * user" elect would hand the flow to someone with no permission to record it.
 *
 * Returns undefined when nobody can drive (no GM, no active owner) — the correct no-op.
 */
export const flowElectFor = actor =>
  game.users.activeGM ?? (actor ? rollerUserFor(actor) : undefined);

/** Is THIS client the flow elect for that actor? Identical to `isActiveGM()` whenever a GM is on. */
export const isFlowElectFor = actor => flowElectFor(actor)?.isSelf ?? false;

/**
 * Does THIS client drive a moment whose subject is `subjectUuid`? The one question every
 * machine asks, in one place (v1.27.2 — mastery.js grew the first copy, and three more were
 * about to follow it).
 *
 * With a GM connected the answer is exactly `isActiveGM()`, so nothing changes for a normal
 * table. With none, the subject's own player drives — and a subject that cannot be resolved
 * drives nothing, which is the correct no-op rather than a guess.
 */
export function drivesMomentFor(subjectUuid) {
  if ( isActiveGM() ) return true;
  if ( game.users.activeGM ) return false;   // a GM is on and it is not us — never two drivers
  const actor = (() => { try { return fromUuidSync(subjectUuid); } catch { return null; } })();
  return !!actor && isFlowElectFor(actor);
}

/**
 * May this client actually WRITE to that actor — apply an effect, press a condition, move HP?
 * GMs own everything; a player owns their own sheet and nothing on the monster side. This is
 * the guard that turns a silent permission failure into a spoken one.
 */
export const canApplyTo = actor => !!actor?.isOwner;

/**
 * Tell the flow's driver what did NOT happen, and what still stands. Whispered, because it is
 * an operational notice about the room rather than a table moment — and self-addressed, so it
 * never lands in front of players as an error. Best-effort: a notice that cannot be posted is
 * never worth throwing over.
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
 * Should THIS client drive the continuation? The client that rolled the attack owns it (its
 * attack, its dice); if that user has gone offline the active GM takes over so a hold can
 * never strand the chain.
 */
export function isContinuingClient(hold) {
  const owner = game.users.get(hold?.continuedBy);
  return owner?.active ? owner.isSelf : isActiveGM();
}

/** Is this actor a combatant in a combat that has actually started? */
export function inRunningCombat(actor) {
  return game.combats.some(c => c.started && c.combatants.some(cb => cb.actor?.id === actor.id));
}

/**
 * The started combat this actor is in **and that the world is actually running** — i.e. it is
 * `game.combat` — or null.
 *
 * ⚠ WHY THIS IS NOT `inRunningCombat` (v1.27.1, reported from the table). A round-based
 * ActiveEffect duration is meaningless except against `game.combat`: Foundry measures
 * `rounds` from `startRound` against the ACTIVE combat, and nothing else. `inRunningCombat`
 * answers a broader question — is this actor in ANY started combat, anywhere in the world —
 * and using that answer to choose `{ rounds: 1 }` produced chips whose clock could never
 * resolve. dnd5e files those under **Unavailable Effects**: born expired, invisible on the
 * token, present only as a line on the sheet with a bare clock and no duration. Sapped landed
 * exactly that way while Vex and Slow — applied when the same combat happened to be active —
 * looked fine, which is what made it read as "Sap is broken" rather than "the clock is".
 */
export function activeCombatFor(actor) {
  const combat = game.combat;
  if ( !combat?.started ) return null;
  return combat.combatants.some(cb => cb.actor?.id === actor?.id) ? combat : null;
}

/**
 * WHEN we are, as a comparable string: `${combat.id}:${round}:${turn}`, or null out of combat.
 *
 * The once-per-turn idiom, and the reason it needs no hook and no elect: a stamp is written
 * beside the thing it governs (a cleave arm, a bash offer) and **any mismatch at read time IS
 * expiry** — no timer to fire, no sweep to miss, and it survives a reload because both halves
 * are persisted facts. Out of combat there is no turn to end, so callers that still need a
 * bound fall back to their own TTL (mastery's cleave arm is the reference).
 *
 * ⚠ It lived in `mastery.js` until 2026-08-23 and `maneuvers.js` imported it from there — a
 * combat-identity fact inside a feature, which is the D1 pattern and was pinned as §10 D9(b).
 * It is a "who/when" fact, so it belongs in this family beside `inRunningCombat`.
 * ⚠ Its old doc line carried the provenance and it is kept here: it was exported for **the
 * walk's (g)** — the bash offer's once-per-turn discipline reuses it — which is precisely the
 * second customer that made it a service rather than a favour.
 */
export const combatStamp = () => {
  const c = game.combat;
  return c?.started ? `${c.id}:${c.round}:${c.turn}` : null;
};

/**
 * THE DATA-PLANE STAMP (the party-stats commission, 2026-08-27): every consequence this module
 * assigns — damage, healing, an applied effect, a spend, a table moment — carries WHEN it
 * happened (`combat`, the stamp above; null out of combat BY CONTRACT, and reports group that
 * bucket as "out of combat" rather than dropping it) and WHO caused it (`sourceUuid`, an actor
 * uuid; null when no actor can honestly be named). An external reader (the stats MCP) folds
 * cards into a ledger off these two fields without parsing HTML and without re-deriving
 * context after the fact — both facts are resolved HERE, at write time, where they are still
 * live. A reader reconstructing either later is the drift the commission's R-A ruling forbids.
 *
 * ⚠ ONE SHAPE, SPREAD — never hand-rolled at a write site. Writers spread `...statContext(src)`
 * into the flag or entry they already write; the receipt families thread it through
 * decide/receipt.js's constructors. Both fields are ALWAYS present on a stamped record: an
 * explicit null means "resolved at write time, and the answer was nothing", while an ABSENT
 * field marks a record from before this plane existed — the distinction a scan uses to tell
 * legacy history from an out-of-combat event.
 *
 * ⚠ Deliberately NOT a post-hoc hook. A central createChatMessage/update stamper was considered
 * and rejected: it would re-derive context after the consequence (exactly what this exists to
 * prevent), and a receipt whose entries land across turns — a held target's verdict arriving
 * next round — needs PER-ENTRY stamps only the write site can supply. The chat log stays the
 * bus; the baseline is this function, not a listener.
 */
export const statContext = (sourceUuid = null) => ({ combat: combatStamp(), sourceUuid });

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

