// Read-only probe (2026-09-04): what the table's Goading / Trip cards actually carry — the saves
// verdicts, the effect receipts, the target's effects and the combat state — after the report
// "applying goading attack didnt do anything". Nothing is written.
//
//   node tools/probe-hitmenu-table.mjs [messageId ...]     default: every card with a hitManeuverCard flag
// ⚠ Disconnect the MCP bridge first (the sole-GM preflight).
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const ids = process.argv.slice(2);
const f = await connectSuite({ tag: "probe-hitmenu", watchdogMs: 120_000, requireElect: false, env: loadEnv() });
const out = await f.evaluate(async ({ ids }) => {
  const MOD = "fvtt-mod-battleflow";
  const cards = ids.length ? ids.map(id => game.messages.get(id)).filter(Boolean)
    : game.messages.contents.filter(m => m.getFlag(MOD, "hitManeuverCard")).slice(-6);
  const report = [];
  for ( const card of cards ) {
    const hc = card.getFlag(MOD, "hitManeuverCard");
    const saves = card.getFlag(MOD, "saves");
    const er = card.getFlag(MOD, "effectReceipt");
    const targets = [];
    for ( const t of (saves?.targets ?? []) ) {
      const actor = await fromUuid(t.uuid).catch(() => null);
      targets.push({ name: t.name, outcome: t.outcome, done: t.done, applied: t.applied, total: t.total,
        effectsNow: actor?.effects?.map(e => `${e.name}${e.disabled ? " (disabled)" : ""} origin=${e.origin ?? ""} dur=${JSON.stringify(e.duration?.toObject?.() ?? e.duration)}`) ?? null,
        isOwnerHere: actor?.isOwner ?? null,
        playerOwners: actor ? game.users.filter(u => !u.isGM && actor.testUserPermission(u, "OWNER")).map(u => `${u.name}${u.active ? " (active)" : ""}`) : null });
    }
    const item = hc?.attackId ? game.messages.get(hc.attackId)?.getAssociatedActor()?.items?.find(i => i.name === hc.feature) : null;
    const act = item ? [...item.system.activities].find(a => a.type === "save") : null;
    report.push({
      id: card.id, when: new Date(card.timestamp).toISOString(), hc: hc ? { key: hc.key, feature: hc.feature, onFail: hc.onFail, effectUuid: hc.effectUuid, applied: hc.applied, sourceUuid: hc.sourceUuid } : null,
      saves: saves ? { dc: saves.dc, abilities: saves.abilities, sourceUuid: saves.sourceUuid, effectsHandled: saves.effectsHandled, keys: Object.keys(saves) } : null,
      effectReceipt: er ?? null,
      targets,
      activity: act ? { name: act.name, effects: act.effects?.map(e => ({ id: e._id, onSave: e.onSave, resolves: !!e.effect, name: e.effect?.name, transfer: e.effect?.transfer })), applicable: act.applicableEffects?.map(e => e.name) } : null
    });
  }
  return { cards: report, combat: game.combat ? { id: game.combat.id, round: game.combat.round, turn: game.combat.turn, current: game.combat.combatant?.name ?? null, scene: game.combat.scene?.name ?? null } : null,
    gm: game.users.filter(u => u.isGM).map(u => `${u.name}${u.active ? " (active)" : ""}`) };
}, { ids });
console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, "probe-hitmenu");
