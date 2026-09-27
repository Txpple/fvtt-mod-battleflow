// Apply `macro-clear-and-rest.js` to the world's "Clear Temp Effects" macro, IN PLACE: keeping the
// document id keeps every hotbar pin (a delete + create would silently unpin it).
//
//   node tools/content/apply-macro-clear-rest.mjs               -> the local sandbox (default)
//   BF_TARGET=prod node tools/content/apply-macro-clear-rest.mjs -> Molten prod, deliberately
//
// ⚠ IT NEVER EXECUTES THE MACRO, on either world: it writes the document and reads it back.
//
// ⚠ ON PROD it stops if anyone else is connected: it is a full-board reset button, and swapping what
// it does under a live table changes what the next press does. Say yes on purpose:
//
//   BF_TARGET=prod BF_MACRO_FORCE=1 node tools/content/apply-macro-clear-rest.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Foundry, loadEnv } from 'fvtt-mcp-dnd5e/client';
import { foundryConfig, isProdTarget } from './target.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const COMMAND = readFileSync(join(here, 'macro-clear-and-rest.js'), 'utf8');
const NEW_NAME = 'Clear Temp Effects + Full Rest (Scene)';
const OLD_NAME = 'Clear Temp Effects (Scene)';
const MACRO_ID = '8ablqYRiKDOEWLPz';   // same id on both worlds — the sandbox is a copy of prod

const env = loadEnv();
setTimeout(() => { console.error('[macro] WATCHDOG 180s'); process.exit(3); }, 180_000);

const f = new Foundry(foundryConfig(env));
await f.connect();

const out = await f.evaluate(async ({ command, newName, oldName, macroId, prod, force }) => {
  const others = game.users.filter(u => u.active && !u.isSelf).map(u => u.name);
  // Anyone else on prod: stop unless this run said yes on purpose.
  if (prod && others.length && !force) return { refused: true, others };

  const macro = game.macros.get(macroId)
    ?? game.macros.getName(newName)
    ?? game.macros.getName(oldName);
  if (!macro) return { fatal: `no macro by id ${macroId} or name "${oldName}"`, others };

  const pinsOf = id => game.users.map(u => ({
    user: u.name,
    slots: Object.entries(u.hotbar ?? {}).filter(([, v]) => v === id).map(([s]) => Number(s))
  })).filter(p => p.slots.length);

  const before = { id: macro.id, name: macro.name, bytes: (macro.command ?? '').length, pins: pinsOf(macro.id) };
  await macro.update({ name: newName, command });
  const after = game.macros.get(macro.id);

  return {
    others, before,
    after: {
      id: after.id, name: after.name, bytes: (after.command ?? '').length,
      restCallPresent: after.command.includes('longRest({ dialog: false, chat: false })'),
      honestCount: after.command.includes('if ( result ) rested += 1;'),
      pins: pinsOf(after.id)
    }
  };
}, { command: COMMAND, newName: NEW_NAME, oldName: OLD_NAME, macroId: MACRO_ID,
     prod: isProdTarget(), force: process.env.BF_MACRO_FORCE === '1' });

if (out.refused) {
  console.error(`[macro] REFUSED — ${out.others.length} other user(s) on PROD: ${out.others.join(', ')}.`);
  console.error('[macro] This swaps what a full-board reset button does. Confirm nobody is mid-session,');
  console.error('[macro] then re-run with BF_MACRO_FORCE=1 to say yes on purpose.');
  process.exit(4);
}
if (out.fatal) { console.error('[macro] FATAL:', out.fatal); process.exit(2); }
if (out.others.length) console.log(`[macro] note: other users connected — ${out.others.join(', ')}`);

console.log(JSON.stringify(out, null, 2));
const ok = out.after.restCallPresent && out.after.honestCount
  && (out.after.id === out.before.id)
  && (JSON.stringify(out.after.pins) === JSON.stringify(out.before.pins));
console.log(ok ? '\n[macro] APPLIED — rest call present, honest counting, hotbar pins unchanged'
                : '\n[macro] SOMETHING IS OFF — compare before/after above');
process.exit(ok ? 0 : 1);
