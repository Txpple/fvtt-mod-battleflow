// Verify the live world settings against the user's reference configuration. THE REFERENCE
// TABLE BELOW IS THE SINGLE SOURCE — it used to be mirrored in a doc, and a mirror is a thing
// that drifts. Standing rule: after ANY suite, probe or test session, verify and restore
// drift; when the USER changes a setting, update the TABLE HERE, never fight it. Reads every
// world-scoped key, reports drift, and restores it with --fix. Timer values are the
// 2026-08-27 user call: every timer 24s (superseded 2026-08-17's 15s).
import { Foundry, loadEnv } from 'fvtt-mcp-dnd5e/client';
import { foundryConfig } from './target.mjs';
import { LIST_SPECS } from '../scripts/decide/registry.js';
import { disposeSafely } from './harness.mjs';

const FIX = process.argv.includes('--fix');
const env = loadEnv();
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
  interruptList: 'Shield:ac, Absorb Elements:damage, Uncanny Dodge:damage, Defensive Duelist:ac, Illusory Self:ac, Glorious Defense:ac, Parry:ac, Counterattack:ac, Defensive Stance:ac, Whirlwind of Sand:ac, Deflect Attacks:damage, Stone\'s Endurance:damage, Lucky:roll, Warding Flare:roll, Shadowy Dodge:roll',   // the roll kind joined 2026-09-24 (Slice A)
  holdReveal: true,
  holdTimer: 24,          // user 2026-08-27: all timers 24s (30 briefly the same day; 15 per 2026-08-17, 12 before)
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
  noticeTimer: 24,        // the Vex/Sap/Cleave reminder's clock. Was a 15s CONSTANT in
                          // mastery.js until 2026-09-01 — the 2026-08-27 "all timers 24s"
                          // call swept the settings file, and this window was not in it.
                          // Listed here so the next sweep cannot miss it again.
  maneuverFolds: "Precision Attack:precision, Riposte:riposte, Shield Master:interpose, Shield Master:bash, Great Weapon Master:hew, Commander's Strike:command, Tavern Brawler:shove",   // shove joined 2026-09-25 (the origin feats)   // command joined 2026-09-05   // v1.19.0 — the list IS the switch; interpose/bash/hew joined at the walk's scope-adds
  // ⚠ v1.23.0 — the d20 folds. These MUST be listed here: the loop below walks the REFERENCE,
  // so a registered setting that this table does not name is simply never checked, and drifts
  // in silence forever. (`missing` catches the opposite case — a reference key with no
  // registration — but nothing catches a registration with no reference key.)
  d20Folds: 'Heroic Inspiration:heroic, Tactical Mind:tactical, Inspired:bardic, Ambush:tactical, Tactical Assessment:tactical, Seeking Spell:seeking, Lucky:advantage',   // the two scoped folds joined 2026-09-05; Seeking Spell 2026-09-09
  d20FoldAsk: true,       // auto-offer where the module owns the number; checks are always player-pressed
  concMode: 'prompt',
  concTimer: 24,          // user 2026-08-27: all timers 24s
  concBreak: true,
  concVisibility: true,
  saves: true,
  saveTimer: 24,          // user 2026-08-27: all timers 24s (15 per 2026-08-17, 6 before)
  damageTimer: 24,        // new in v1.19.0 walk-4 (w) — the offered roll's clock, family default
  castApply: true,
  volleys: true,          // new in v1.20.0 (Pass C) — structural multi-projectile fold; rides the resolver mode + damageTimer
  resourceNotices: true,  // new in v1.20.0 (user ask) — the spend flash + card line; recovery-rhythm pools only
  // ⚠ The reminder gate's two lists (2026-09-01). Both are SWITCHES — an empty Reminder Sources
  // list is the gate turned off — and smoke-reminders §6 pins them to '' and 'blinded' to prove
  // it, so a run that dies inside §6 leaves the gate off in the world. Named here for exactly
  // the reason the d20Folds comment above gives: an unlisted key is never checked.
  reminderList: 'vex, sap, prone, condition, range, effect, sneak, buy',   // range and effect joined 2026-09-02 (user asks); sneak the same day (the prototype)
  conditionList: 'blinded, invisible, hiding, paralyzed, petrified, poisoned, restrained, stunned, unconscious, frightened, grappled, incapacitated, dodging, charmed',   // hiding joined 2026-09-02 (user ask)
  effectList: LIST_SPECS.effects.default,   // the whole effect table, as shipped (2026-09-02) — the table is the reference, never a copy of it
  clockRiderList: LIST_SPECS.clockRiders.default,
  hitMenuList: LIST_SPECS.hitMenu.default,   // the whole hit-option table, as shipped (2026-09-04)   // the whole clock-rider table, as shipped (2026-09-02, user ask)
  emanations: true,                                 // 2026-09-03 (user ruling) — the platform's Region keeps the aura
  emanationList: LIST_SPECS.emanations.default,     // the whole emanation table, as shipped
  damageShieldList: LIST_SPECS.damageShields.default,   // the whole damage-shield table, as shipped (2026-09-04)
  damageSaveList: LIST_SPECS.damageSaves.default,       // the whole damage-save table, as shipped (2026-09-04)
  superiorityUseList: LIST_SPECS.superiorityUses.default,   // the whole superiority-use table, as shipped (2026-09-05)
  effectChoiceList: LIST_SPECS.effectChoices.default,       // the whole effect-choice table, as shipped (2026-09-05)
  metamagicList: LIST_SPECS.metamagic.default,              // the whole metamagic table, as shipped (2026-09-09)
  spentAreaList: LIST_SPECS.spentAreas.default,             // the whole spent-area table, as shipped (2026-09-10)
  chosenAreaList: LIST_SPECS.chosenAreas.default,           // the whole chosen-area table, as shipped (2026-09-24)
  damageEitherList: LIST_SPECS.damageEither.default,        // the whole rolled-twice table, as shipped (Slice A, 2026-09-24)
  tokenLightList: LIST_SPECS.tokenLights.default,           // the whole token-light table, as shipped (the Aasimar walk, 2026-09-25)
  tokenSenseList: LIST_SPECS.tokenSenses.default,           // the whole token-sense table, as shipped (the Dwarf walk, 2026-09-25)
  tokenSizeList: LIST_SPECS.tokenSizes.default,             // the whole token-size table, as shipped (the Goliath walk, 2026-09-25)
  rebukeList: LIST_SPECS.rebukes.default,                   // the whole rebuke table, as shipped (the Goliath walk, 2026-09-25)
  cardChipList: LIST_SPECS.cardChips.default,               // the whole card-chip table, as shipped (the Gnome walk, 2026-09-25)
  restGrantList: LIST_SPECS.restGrants.default,             // the whole rest-grant table, as shipped (the Human walk, 2026-09-25)
  dropToOneList: LIST_SPECS.dropToOne.default,              // the whole drop-to-1 table, as shipped (the Orc walk, 2026-09-25)
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
// ⚠ Drift left in place is a non-zero exit (2026-09-03): the battery reads this code for its
// CLEAN/DRIFTED line, and one run printed CLEAN over six drifted settings because drift alone
// exited 0. --fix restores and exits 0; unregistered keys stay 2.
process.exit(out.missing.length ? 2 : (out.drift.length && !FIX) ? 1 : 0);
