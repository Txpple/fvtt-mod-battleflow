// Verify the live world settings against the table's reference configuration: reads every
// world-scoped key, reports drift, and restores it with --fix. Run after any suite or probe.
// The REFERENCE below is the single source: when the table changes a setting, update it here.
import { Foundry, loadEnv } from 'fvtt-mcp-dnd5e/client';
import { foundryConfig } from './target.mjs';
import { LIST_SPECS } from '../scripts/decide/registry.js';
import { disposeSafely } from './harness.mjs';

const FIX = process.argv.includes('--fix');
const env = loadEnv();
setTimeout(() => { console.error('[verify] WATCHDOG 120s'); process.exit(3); }, 120_000);

// THE REFERENCE TABLE (NOTES.md points here). ⚠ Every world-scoped setting must be listed: the
// loop walks this table, so an unlisted registration is never checked and drifts in silence.
const REFERENCE = {
  autoDamage: 'all',
  autoApply: true,
  diceWait: 0,       // the wait for Dice So Nice
  dramaticBeat: 0,   // 0 is the deliberate table value, not suite residue
  requireTarget: true,
  measuredCover: true,    // the 2024 DMG's corner lines: the hover card's Cover section and the attack's AC
  reactionHold: true,
  blockList: 'Magic Missile:Shield',
  interruptList: 'Shield:ac, Absorb Elements:damage, Uncanny Dodge:damage, Defensive Duelist:ac, Illusory Self:ac, Glorious Defense:ac, Parry:ac, Counterattack:ac, Defensive Stance:ac, Whirlwind of Sand:ac, Deflect Attacks:damage, Stone\'s Endurance:damage, Lucky:roll, Warding Flare:roll, Shadowy Dodge:roll, Interception:damage, Protection:roll',
  holdReveal: true,
  holdTimer: 24,   // every timer 24s
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
  noticeTimer: 24,        // the Vex/Sap/Cleave reminder's clock
  maneuverFolds: "Precision Attack:precision, Riposte:riposte, Shield Master:interpose, Shield Master:bash, Great Weapon Master:hew, Commander's Strike:command, Tavern Brawler:shove, Crusher:shove, Polearm Master:hew",
  d20Folds: 'Heroic Inspiration:heroic, Tactical Mind:tactical, Inspired:bardic, Ambush:tactical, Tactical Assessment:tactical, Seeking Spell:seeking, Lucky:advantage, Mage Slayer:succeed',
  d20FoldAsk: true,       // auto-offer where the module owns the number; checks are always player-pressed
  concMode: 'prompt',
  concTimer: 24,   // every timer 24s
  concBreak: true,
  concVisibility: true,
  saves: true,
  saveTimer: 24,   // every timer 24s
  damageTimer: 24,   // the offered roll's clock
  castApply: true,
  volleys: true,   // the multi-projectile fold; rides the resolver mode + damageTimer
  resourceNotices: true,   // the spend flash + card line; recovery-rhythm pools only
  // ⚠ The reminder gate's lists are SWITCHES (empty = off); a run dying inside smoke-reminders §6 leaves the gate off.
  reminderList: 'vex, sap, prone, condition, range, effect, sneak, buy',
  conditionList: 'blinded, invisible, hiding, paralyzed, petrified, poisoned, restrained, stunned, unconscious, frightened, grappled, incapacitated, dodging, charmed',
  effectList: LIST_SPECS.effects.default,
  clockRiderList: LIST_SPECS.clockRiders.default,
  hitMenuList: LIST_SPECS.hitMenu.default,
  emanations: true,   // the platform's Region keeps the aura
  emanationList: LIST_SPECS.emanations.default,
  damageShieldList: LIST_SPECS.damageShields.default,
  damageSaveList: LIST_SPECS.damageSaves.default,
  superiorityUseList: LIST_SPECS.superiorityUses.default,
  effectChoiceList: LIST_SPECS.effectChoices.default,
  metamagicList: LIST_SPECS.metamagic.default,
  spentAreaList: LIST_SPECS.spentAreas.default,
  chosenAreaList: LIST_SPECS.chosenAreas.default,
  initiativeSwapList: LIST_SPECS.initiativeSwaps.default,
  healRerollList: LIST_SPECS.healRerolls.default,
  kitTendList: LIST_SPECS.kitTends.default,
  fightingStyleList: LIST_SPECS.fightingStyles.default,
  unarmedDiceList: LIST_SPECS.unarmedDice.default,
  damageEitherList: LIST_SPECS.damageEither.default,
  tokenLightList: LIST_SPECS.tokenLights.default,
  tokenSenseList: LIST_SPECS.tokenSenses.default,
  tokenSizeList: LIST_SPECS.tokenSizes.default,
  rebukeList: LIST_SPECS.rebukes.default,
  cardChipList: LIST_SPECS.cardChips.default,
  restGrantList: LIST_SPECS.restGrants.default,
  dropToOneList: LIST_SPECS.dropToOne.default,
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
// ⚠ Drift left in place exits 1: the battery reads this code for its CLEAN/DRIFTED line.
// --fix restores and exits 0; unregistered keys exit 2.
process.exit(out.missing.length ? 2 : (out.drift.length && !FIX) ? 1 : 0);
