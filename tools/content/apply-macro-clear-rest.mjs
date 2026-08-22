// Apply `macro-clear-and-rest.js` to the world's "Clear Temp Effects" macro, IN PLACE.
//
// In place, deliberately: keeping the document id keeps every hotbar pin (Matt the DM slot 2).
// A delete + create would silently unpin the button and hand back a macro that looks identical
// and is not on the bar any more.
//
//   node tools/apply-macro-clear-rest.mjs               -> the local sandbox (default)
//   BF_TARGET=prod node tools/apply-macro-clear-rest.mjs -> Molten prod, deliberately
//
// ⚠ IT DOES NOT EXECUTE THE MACRO. Running a full-board reset is not a thing to do to a live
// scene to see whether it works; this writes the document and reads it back. The behaviour was
// proven on the sandbox (see the HANDOFF section "The Clear + Full Rest macro").
//
// ⚠ SOLE-OCCUPANCY GUARD ON PROD, and it is NOT the retired "bridge never connects during live
// play" rule — that was a misreading of the elect and live MCP assistance is ALLOWED (HANDOFF,
// corrected 2026-08-19). The guard is narrower and about THIS macro specifically: it is a
// full-board reset button, and quietly swapping what it does under someone who is mid-session
// means the next press does something they did not agree to. So it stops by default and lets
// you say yes on purpose:
//
//   BF_TARGET=prod BF_MACRO_FORCE=1 node tools/apply-macro-clear-rest.mjs
//
// It never EXECUTES the macro on either world — that part is not negotiable.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';
import { foundryConfig, isProdTarget } from './target.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const COMMAND = readFileSync(join(here, 'macro-clear-and-rest.js'), 'utf8');
const NEW_NAME = 'Clear Temp Effects + Full Rest (Scene)';
const OLD_NAME = 'Clear Temp Effects (Scene)';
const MACRO_ID = '8ablqYRiKDOEWLPz';   // same id on both worlds — the sandbox is a copy of prod

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[macro] WATCHDOG 180s'); process.exit(3); }, 180_000);

const f = new Foundry(foundryConfig(env));
await f.connect();

const out = await f.evaluate(async ({ command, newName, oldName, macroId, prod, force }) => {
  const others = game.users.filter(u => u.active && !u.isSelf).map(u => u.name);
  // Anyone else on prod: stop unless this run said yes on purpose. See the header — this is
  // about not changing a reset button under a live table, not about the bridge being present.
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
