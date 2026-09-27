/**
 * Battle Flow — MACHINE layer (ARCHITECTURE.md §2): the data plane's own stamps (ARCHITECTURE
 * *The data plane*), freight for the external stats reader:
 *   - `rollCtx` — every d20 test message carries `{combat, sourceUuid}`, stamped at roll time on
 *     the rolling client, so by-round meters need no timestamp inference.
 *   - `combatRoster` — a GM-whispered marker card per combat: combatants and order at the start,
 *     the final round at deletion. ⚠ STATIC: a snapshot and a closing count, never clock
 *     ownership (the BACKLOG fence). Late joiners are absent; their rolls carry `rollCtx`.
 * ⚠ Ungated by design (a toggle would punch holes in the ledger); no machine imports.
 */
import { MODULE_ID, TITLE, isActiveGM, statContext } from "./core.js";
import { bfCard } from "./decide/present.js";
// A safe static edge: shared.js registers no hooks and evaluates first.
import { statSourceOf } from "./shared.js";

/**
 * The dispatched names (tools/dnd5e-hooks.json is the pin): checks and saves fire only the non-V2
 * names, death saves and concentration the V2. One roll can fire several through the hookNames
 * chain, hence never-re-stamp. NPC rolls stamp too; the flag keeps the message's visibility.
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
      // ⚠ The MESSAGE's own actor leads (statSourceOf): the hook's subject is the WORLD actor, and
      // an unlinked token's roll must match the identity of the receipt beside it.
      void message.setFlag(MODULE_ID, "rollCtx", statContext(statSourceOf(message) ?? actor?.uuid ?? null))
        .catch(err => console.error(`${TITLE} | rollCtx stamp failed (${hook}).`, err));
    } catch(err) {
      console.error(`${TITLE} | rollCtx stamp failed (${hook}).`, err);
    }
  });
}

/* --- combatRoster — the marker card: stamped at start, closed at deletion, elder twin wins --- */
const rosterMessageFor = combatId => game.messages.contents.findLast(
  m => m.getFlag(MODULE_ID, "combatRoster")?.combatId === combatId);

Hooks.on("combatStart", combat => {
  if ( !isActiveGM() ) return;
  void stampRoster(combat);
});

async function stampRoster(combat) {
  try {
    if ( rosterMessageFor(combat.id) ) return;   // one roster per combat
    // ⚠ A tracker-made encounter is scene-agnostic (combat.scene null): the first combatant's
    // scene resolves it, the active scene the last guess.
    const scene = combat.scene
      ?? game.scenes.get(combat.combatants.contents.find(c => c.sceneId)?.sceneId ?? "")
      ?? game.scenes.active ?? null;
    const combatants = combat.combatants.contents
      .slice()
      .sort((a, b) => (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity))
      .map(c => ({
        // The token-synthetic uuid where one exists — the identity every other stamp uses.
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
        // The scene named on the begin line; the close adds its twin, bracketing the fight.
        lines: [`⚔ Begins on ${scene?.name ?? "the field"}`, ...order],
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

// Two same-account GM sessions both stamp; provenance plus elder-wins makes it one.
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

// Deletion is how encounters end, and the final round is the fact only this moment knows.
// Best-effort — a roster that never closes is still a roster.
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
    // The closing bracket. Content and flag land in ONE update, so clients re-render once.
    const scene = flag.sceneName ?? "the field";
    const order = (flag.combatants ?? []).map(c =>
      `${(c.initiative ?? "—")} · ${c.name}${c.isPC ? "" : " (foe)"}`);
    await message.update({
      content: bfCard({
        eyebrow: "Combat",
        title: flag.sceneName ?? "The field",
        subtitle: `${(flag.combatants ?? []).length} combatants`,
        lines: [`⚔ Begins on ${scene}`, ...order, `🕊 Ends on ${scene} — round ${flag.endedRound}`],
        tone: "neutral"
      }),
      [`flags.${MODULE_ID}.combatRoster`]: flag
    });
  } catch(err) {
    console.error(`${TITLE} | Combat roster close failed.`, err);
  }
}
