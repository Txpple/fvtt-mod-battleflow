// One-shot probe: does a TEMP HP receipt row say "+N temp HP" instead of "−0 HP" in damage red?
// (FLOW item 13, user report 2026-08-19 — Morgash's Dash.) dnd5e 5.3.3's calculateDamage routes
// a `temphp` entry into damages.temp and never into damages.amount, so `taken` is 0 and the old
// two-kind sign test (taken < 0 ⇒ gain) fell through to the damage voice.
//
// It exercises the REAL render path: a message carrying the module's own receipt flag, rendered
// by receipts.js, read back out of the DOM.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';
import { foundryConfig } from './target.mjs';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[probe-temp] WATCHDOG 90s'); process.exit(3); }, 90_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
console.log('[probe-temp] connected');

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const made = [];

  // 1. GROUND TRUTH FIRST: what does dnd5e itself do with a temphp entry? If calc.amount is
  //    not 0 the whole diagnosis is wrong and the card fix is aimed at the wrong thing.
  const victim = game.actors.getName('BF Test Victim');
  const calc = victim?.calculateDamage([{ type: 'temphp', value: 7, active: {} }], { ignore: true });
  const ground = { amount: calc?.amount ?? null, temp: calc?.temp ?? null };

  // 2. Does the value actually LAND? (severity check: card bug vs application bug)
  const beforeTemp = victim.system.attributes.hp.temp ?? 0;
  await victim.applyDamage([{ type: 'temphp', value: 7, active: {} }], { ignore: true });
  const afterTemp = victim.system.attributes.hp.temp ?? 0;

  // 3. THE RENDER: three receipt rows through the real card path — a pure temp grant, plain
  //    damage, and a mixed entry that both damages and grants.
  const row = (name, delta, taken, prior) => ({
    uuid: victim.uuid, name, img: null, prior, delta, taken, traits: [], reverted: false
  });
  const msg = await ChatMessage.create({
    content: '<div class="dnd5e2 chat-card">probe temp hp</div>',
    flags: { [MOD]: { receipt: { targets: [
      row('TempOnly',  { value: 0,  temp: 7 }, 0,  { value: 11, temp: 0 }),
      row('PlainHit',  { value: -3, temp: 0 }, 3,  { value: 11, temp: 0 }),
      row('Mixed',     { value: -3, temp: 4 }, 3,  { value: 11, temp: 0 }),
      row('Healed',    { value: 5,  temp: 0 }, -5, { value: 6,  temp: 0 })
    ] } } }
  });
  made.push(msg.id);
  await sleep(900);

  const el = document.querySelector(`[data-message-id="${msg.id}"]`);
  const text = (el?.innerText ?? '').replace(/\s+/g, ' ').trim();
  // The colour matters as much as the words — a gain in damage maroon is the reported bug.
  const colored = [...(el?.querySelectorAll('span') ?? [])]
    .filter(s => /HP|temp/.test(s.textContent ?? ''))
    .map(s => ({ text: s.textContent.trim(), color: s.style.color }));

  for (const id of made) await game.messages.get(id)?.delete();
  await victim.update({ 'system.attributes.hp.temp': beforeTemp });

  return { ground, applied: { beforeTemp, afterTemp }, text, colored };
});

console.log('\n[probe-temp] dnd5e ground truth for a temphp entry:', JSON.stringify(out.ground));
console.log('[probe-temp] does the value land? ', JSON.stringify(out.applied));
console.log('\n[probe-temp] rendered card text:\n  ', out.text);
console.log('\n[probe-temp] amount spans:');
for (const c of out.colored) console.log(`   ${JSON.stringify(c.text).padEnd(20)} color=${c.color}`);
await f.close?.();
process.exit(0);
