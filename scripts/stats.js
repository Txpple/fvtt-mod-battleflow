/**
 * Battle Flow — MACHINE layer (ARCHITECTURE.md §2): the DATA PLANE's own edge (§4 "The data
 * plane — stat stamps") — context stamps no other machine owns. Two concerns live here, both
 * invisible freight for the external stats reader (the party-stats commission, second pass
 * 2026-08-27):
 *
 *   - `rollCtx` — every d20 TEST message (attack, save, ability check, skill, tool, death
 *     save, concentration) carries `{combat, sourceUuid}` stamped AT ROLL TIME on the rolling
 *     client. Without it a plain roll has no round context and every by-round meter (hit
 *     rates, targeting pressure, save-success-by-DC, death-save drama) rides timestamp
 *     inference. This is the in-band idiom, not the rejected post-hoc stamper: these hooks
 *     fire in the moment, on the client that owns the message.
 *   - `combatRoster` — a one-time static snapshot per combat (combatants, initiative order),
 *     stamped on a GM-whispered marker card at combatStart and closed with the final round
 *     count when the encounter is deleted. Encounter documents die with cleanup; the chat log
 *     is the bus, so the turn→actor map survives there. ⚠ STATIC BY RULING (user, 2026-08-27):
 *     a snapshot at start plus a closing count is NOT clock ownership — nothing here tracks
 *     turns, arms timers, or sweeps expiry, and nothing may grow to (the BACKLOG fence).
 *     Combatants who join after the start are deliberately absent; their rolls still carry
 *     `rollCtx`, which is how a scan sees them.
 *
 * ⚠ Depend downward only: core (the stamp), decide/present (the card shell). No machine
 * imports, no settings — the data plane is UNGATED by ruling (a toggle that punches holes in
 * the ledger is a footgun).
 */
import { MODULE_ID, TITLE, isActiveGM, statContext } from "./core.js";
import { bfCard } from "./decide/present.js";
// Safe as a STATIC edge: shared.js registers no hooks and the entry graph evaluates it first.
import { statSourceOf } from "./shared.js";

/* ---------------------------------------------------------------------------------------------
 * rollCtx — the d20 test stamp, on the rolling client
 * ------------------------------------------------------------------------------------------- */

/**
 * The dispatched names (tools/dnd5e-hooks.json is the pin; the V2-name trap is d20-folds.js's
 * header lesson — checks and saves fire only the non-V2 names, death saves and concentration
 * fire V2). One roll can fire SEVERAL of these through the hookNames chain, which is why the
 * stamp guard is never-re-stamp rather than one-hook-per-roll. NPC rolls stamp too — the flag
 * rides the message under the message's own visibility, so a hidden GM roll stays hidden;
 * context is not a secret.
 */
const D20_TEST_HOOKS = [
  "dnd5e.rollAttackV2",
  "dnd5e.rollSavingThrow",
  "dnd5e.rollAbilityCheck",
  "dnd5e.rollSkill",
  "dnd5e.rollToolCheck",
  "dnd5e.rollDeathSaveV2",
  "dnd5e.rollConcentrationV2"
];

for ( const hook of D20_TEST_HOOKS ) {
  Hooks.on(hook, (rolls, ctx) => {
    try {
      const subject = ctx?.subject;
      const actor = (subject instanceof Actor) ? subject : (subject?.actor ?? null);
      const message = rolls?.[0]?.parent;
      if ( !(message instanceof ChatMessage) ) return;   // a roll without a message has no card to stamp
      if ( message.getFlag(MODULE_ID, "rollCtx") ) return;   // the hookNames chain re-fires; first stamp wins
      // ⚠ The MESSAGE's own actor leads (statSourceOf) — the hook's subject is the WORLD
      // actor, and an unlinked token's roll would spell its identity differently from the
      // receipt beside it (caught by §3b the day this shipped). One identity, every family.
      void message.setFlag(MODULE_ID, "rollCtx", statContext(statSourceOf(message) ?? actor?.uuid ?? null))
        .catch(err => console.error(`${TITLE} | rollCtx stamp failed (${hook}).`, err));
    } catch(err) {
      console.error(`${TITLE} | rollCtx stamp failed (${hook}).`, err);
    }
  });
}

/* ---------------------------------------------------------------------------------------------
 * combatRoster — the marker card: stamped at start, closed at deletion, elder twin wins
 * ------------------------------------------------------------------------------------------- */

const rosterMessageFor = combatId => game.messages.contents.findLast(
  m => m.getFlag(MODULE_ID, "combatRoster")?.combatId === combatId);

Hooks.on("combatStart", combat => {
  if ( !isActiveGM() ) return;
  void stampRoster(combat);
});

async function stampRoster(combat) {
  try {
    if ( rosterMessageFor(combat.id) ) return;   // resume/re-fire: one roster per combat
    const scene = combat.scene ?? null;
    const combatants = combat.combatants.contents
      .slice()
      .sort((a, b) => (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity))
      .map(c => ({
        // The token-synthetic uuid where one exists — the same identity every other stamp
        // resolves to, so the scan joins without normalizing.
        actorUuid: c.token?.actor?.uuid ?? c.actor?.uuid ?? null,
        tokenId: c.tokenId ?? null,
        name: c.name,
        initiative: c.initiative ?? null,
        isPC: c.actor?.type === "character"
      }));
    const order = combatants.map(c =>
      `${(c.initiative ?? "—")} · ${c.name}${c.isPC ? "" : " (foe)"}`);
    await ChatMessage.create({
      whisper: game.users.filter(u => u.isGM).map(u => u.id),
      speaker: { alias: "Battle Flow" },
      content: bfCard({
        eyebrow: "Combat",
        title: scene?.name ?? "The field",
        subtitle: `${combatants.length} combatants`,
        lines: order,
        tone: "neutral"
      }),
      flags: { [MODULE_ID]: { combatRoster: {
        combatId: combat.id,
        sceneId: scene?.id ?? null,
        sceneName: scene?.name ?? null,
        startedAt: Date.now(),
        combatants,
        ...statContext(null)
      } } }
    });
  } catch(err) {
    console.error(`${TITLE} | Combat roster stamp failed.`, err);
  }
}

// The twin-elect converge (mastery's topple idiom, same reason): two same-account sessions
// both pass isActiveGM and both stamp; provenance (combatId) + elder-wins makes it one.
Hooks.on("createChatMessage", message => {
  if ( !isActiveGM() ) return;
  const flag = message.getFlag(MODULE_ID, "combatRoster");
  if ( !flag?.combatId ) return;
  const elder = game.messages.contents.some(m => {
    if ( m.id === message.id ) return false;
    if ( m.getFlag(MODULE_ID, "combatRoster")?.combatId !== flag.combatId ) return false;
    return (m.timestamp < message.timestamp)
      || ((m.timestamp === message.timestamp) && (m.id < message.id));
  });
  if ( elder ) message.delete().catch(() => { /* the other twin got there first */ });
});

// The close: deletion IS how encounters end, and the final round count is the one fact only
// this moment still knows. Best-effort — a roster that never closes is still a roster.
Hooks.on("deleteCombat", combat => {
  if ( !isActiveGM() ) return;
  void closeRoster(combat);
});

async function closeRoster(combat) {
  try {
    const message = rosterMessageFor(combat.id);
    const flag = foundry.utils.deepClone(message?.getFlag(MODULE_ID, "combatRoster") ?? null);
    if ( !flag || (flag.endedRound != null) ) return;
    flag.endedRound = combat.round;
    flag.endedAt = Date.now();
    await message.setFlag(MODULE_ID, "combatRoster", flag);
  } catch(err) {
    console.error(`${TITLE} | Combat roster close failed.`, err);
  }
}
