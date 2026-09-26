// Read back the BF Styles roster's fighting-style faces (HANDOFF.md §1) — a content check, asserts nothing.
import { connectSuite } from '../harness.mjs';

const f = await connectSuite({ tag: 'check-styles', watchdogMs: 120_000 });
const out = await f.evaluate(async () => game.actors.filter(a => a.name.startsWith('BF Style ')).map(a => ({
  name: a.name, ac: a.system.attributes.ac.value,
  faces: a.effects.filter(e => e.getFlag('fvtt-mod-battleflow', 'fightingStyle')).map(e => `${e.name} [${e.disabled ? 'off' : 'live'}] ${e.getFlag('fvtt-mod-battleflow', 'fightingStyle').detail}`),
  equipped: a.items.filter(i => i.system?.equipped === true && ['weapon', 'equipment'].includes(i.type)).map(i => i.name)
})), null);
console.log(JSON.stringify(out, null, 1));
await f.disconnect?.();
process.exit(0);
