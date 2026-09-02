// One-off probe (2026-09-02): why did Web's failed save not press Restrained? Read Web's save
// activity as the sheet holds it — its effects, which are applicable, the effect's statuses —
// and the last Web demand card's flags.
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const env = loadEnv();
const f = await connectSuite({ tag: "probe-web", watchdogMs: 120_000, requireElect: false, env });
const out = await f.evaluate(async () => {
  const MOD = "fvtt-mod-battleflow";
  const info = { casters: [] };
  for ( const actor of game.actors ) {
    const web = actor.items.find(i => i.name === "Web");
    if ( !web ) continue;
    const acts = [...(web.system.activities ?? [])].map(a => ({
      name: a.name, type: a.type, uuid: a.uuid,
      effects: (a.effects ?? []).map(e => ({ id: e._id, onSave: e.onSave, resolved: !!e.effect, name: e.effect?.name, statuses: [...(e.effect?.statuses ?? [])] })),
      applicable: (a.applicableEffects ?? []).map(e => e.id),
      save: a.save ? { ability: [...a.save.ability], dc: a.save.dc?.value } : null,
      onSaveDamage: a.damage?.onSave ?? null, parts: (a.damage?.parts ?? []).length,
      target: a.target?.template?.type ?? null, duration: web.system.duration
    }));
    info.casters.push({ actor: actor.name, itemUuid: web.uuid, source: web.flags?.core?.sourceId ?? web._stats?.compendiumSource ?? null,
      itemEffects: web.effects.map(e => ({ id: e.id, name: e.name, statuses: [...e.statuses], transfer: e.transfer, changes: e.changes.map(c => c.key) })),
      activities: acts });
  }
  const cards = game.messages.contents.filter(m => m.getFlag(MOD, "saves") && /web/i.test(m.getFlag(MOD, "saves")?.item?.name ?? "")).slice(-2);
  info.cards = cards.map(m => ({ id: m.id, saves: m.getFlag(MOD, "saves"), effectReceipt: m.getFlag(MOD, "effectReceipt") ?? null,
    itemUuid: m.getFlag("dnd5e", "item")?.uuid ?? null, activityUuid: m.getFlag("dnd5e", "activity")?.uuid ?? null }));
  const dummy = game.actors.getName("Practice Dummy");
  info.dummyEffects = dummy?.effects.map(e => ({ name: e.name, statuses: [...e.statuses], origin: e.origin })) ?? null;
  return info;
}, null);
console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, "probe-web");
process.exit(0);
