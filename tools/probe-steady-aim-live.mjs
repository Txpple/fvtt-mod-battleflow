// Read-only look at the live world after the user's Steady Aim report (2026-09-02): the chip on
// the rogue, the reminder records on the rogue's attack cards since the feature was used, and
// what the gate's effect pass sees right now. Usage: node tools/probe-steady-aim-live.mjs
import { connectSuite, disposeSafely, loadEnv } from './harness.mjs';

const f = await connectSuite({ tag: 'probe-steady-live', watchdogMs: 120_000, requireElect: false, env: loadEnv() });
try {
  const out = await f.evaluate(async () => {
    const MOD = 'fvtt-mod-battleflow';
    const rogue = game.actors.getName('BF Test Rogue');
    const chips = rogue.effects.filter(e => e.name === 'Steady Aim').map(e => ({
      id: e.id, disabled: e.disabled, duration: e.duration, flags: e.flags[MOD], changes: e.changes, origin: e.origin,
      isTemporary: e.isTemporary, statuses: [...e.statuses],
    }));
    const combat = game.combats.find(c => c.combatants.some(k => k.actorId === rogue.id));
    const msgs = game.messages.contents.filter(m => m.speaker?.actor === rogue.id && m.timestamp > Date.now() - 3 * 3600 * 1000)
      .map(m => ({
        id: m.id, at: new Date(m.timestamp).toISOString(), title: (m.flavor || m.content.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').slice(0, 80),
        bf: m.flags?.[MOD] ? Object.fromEntries(Object.entries(m.flags[MOD]).map(([k, v]) => [k, JSON.stringify(v).slice(0, 600)])) : null,
        rolls: m.rolls?.map(r => r.formula) ?? [],
      }));
    const settings = {
      reminderList: game.settings.get(MOD, 'reminderList'),
      effectListHasSteady: /steady aim/i.test(game.settings.get(MOD, 'effectList')),
    };
    return { chips, combat: combat ? { id: combat.id, round: combat.round, turn: combat.turn, active: combat.active } : null, msgs, settings };
  });
  console.log(JSON.stringify(out, null, 2));
} finally {
  await disposeSafely(f, 'probe-steady-live');
  process.exit(0);
}
