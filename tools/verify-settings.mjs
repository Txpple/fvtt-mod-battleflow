// Verify the live world settings against the user's reference configuration. THE REFERENCE
// TABLE BELOW IS THE SINGLE SOURCE — it used to be mirrored in a doc, and a mirror is a thing
// that drifts. Standing rule: after ANY suite, probe or test session, verify and restore
// drift; when the USER changes a setting, update the TABLE HERE, never fight it. Reads every
// world-scoped key, reports drift, and restores it with --fix. Timer values are the
// 2026-08-17 user call: every timer 15s.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';
import { foundryConfig } from './target.mjs';
import { disposeSafely } from './harness.mjs';

const FIX = process.argv.includes('--fix');
const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[verify] WATCHDOG 120s'); process.exit(3); }, 120_000);

// THE REFERENCE TABLE — the single source (NOTES.md points here). Update it when the
// user's taste changes; never edit the world to match a stale copy.
const REFERENCE = {
  autoDamage: 'all',
  autoApply: true,
  dramaticBeat: 0,   // user call 2026-08-20 (third walk): "set all the beats to 0" — 0 is the DELIBERATE table value now, not suite residue; the module default already agrees
  requireTarget: true,
  reactionHold: true,
  blockList: 'Magic Missile:Shield',
  interruptList: 'Shield:ac, Absorb Elements:damage, Uncanny Dodge:damage, Defensive Duelist:ac, Illusory Self:ac, Glorious Defense:ac, Parry:ac, Counterattack:ac, Defensive Stance:ac, Whirlwind of Sand:ac, Deflect Attacks:damage, Stone\'s Endurance:damage',
  holdReveal: true,
  holdTimer: 15,          // user 2026-08-17: all timers 15s (was 12)
  holdSkipFutile: true,
  holdApplyEffect: true,
  holdSettle: 8,
  hideCardButtons: true,
  riders: true,
  riderList: 'hunters-mark, hex, great-old-one-hex',
  riderUpgrades: 'foe-slayer:hunters-mark',
  effectRiders: true,
  masteryRiders: true,
  masteryAsk: 'ask',
  maneuverFolds: 'Precision Attack:precision, Riposte:riposte, Shield Master:interpose, Shield Master:bash, Great Weapon Master:hew',   // v1.19.0 — the list IS the switch; interpose/bash/hew joined at the walk's scope-adds
  // ⚠ v1.23.0 — the d20 folds. These MUST be listed here: the loop below walks the REFERENCE,
  // so a registered setting that this table does not name is simply never checked, and drifts
  // in silence forever. (`missing` catches the opposite case — a reference key with no
  // registration — but nothing catches a registration with no reference key.)
  d20Folds: 'Heroic Inspiration:heroic, Tactical Mind:tactical, Inspired:bardic',
  d20FoldAsk: true,       // auto-offer where the module owns the number; checks are always player-pressed
  concMode: 'prompt',
  concTimer: 15,
  concBreak: true,
  concVisibility: true,
  saves: true,
  saveTimer: 15,          // user 2026-08-17: all timers 15s (was 6)
  damageTimer: 15,        // new in v1.19.0 walk-4 (w) — the offered roll's clock, family default
  castApply: true,
  volleys: true,          // new in v1.20.0 (Pass C) — structural multi-projectile fold; rides the resolver mode + damageTimer
  resourceNotices: true   // new in v1.20.0 (user ask) — the spend flash + card line; recovery-rhythm pools only
};

const f = new Foundry(foundryConfig(env));
console.log('[verify] connecting…');
await f.connect();

const out = await f.evaluate(async ({ reference, fix }) => {
  const MOD = 'fvtt-mod-battleflow';
  const drift = [];
  const missing = [];
  for (const [key, want] of Object.entries(reference)) {
    if (!game.settings.settings.has(`${MOD}.${key}`)) { missing.push(key); continue; }
    const have = game.settings.get(MOD, key);
    const norm = v => (typeof v === 'string') ? v.replace(/\s+/g, ' ').trim() : v;
    if (norm(have) !== norm(want)) {
      drift.push({ key, have, want });
      if (fix) await game.settings.set(MOD, key, want);
    }
  }
  return { drift, missing };
}, { reference: REFERENCE, fix: FIX });

if (out.missing.length) console.log(`[verify] UNREGISTERED keys (old client code?): ${out.missing.join(', ')}`);
if (!out.drift.length) console.log('[verify] CLEAN — every setting matches the reference table.');
else {
  for (const d of out.drift) console.log(
    `  DRIFT ${d.key}: have ${JSON.stringify(d.have)} want ${JSON.stringify(d.want)}${FIX ? ' — FIXED' : ''}`);
  console.log(`[verify] ${out.drift.length} drifted${FIX ? ', restored' : ' — rerun with --fix to restore'}.`);
}
await disposeSafely(f, 'verify');
process.exit(out.missing.length ? 2 : 0);
