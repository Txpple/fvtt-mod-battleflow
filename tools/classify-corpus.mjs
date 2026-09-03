// Classify the corpus scan-corpus.mjs wrote: which FAMILY of table mechanism each race trait,
// class feature, subclass feature, feat and spell would want, judged from the pack's own
// structure (activities, effects, activation) and its text, and whether the registry already
// names it. This is the survey behind the abilities sweep — offline, no Foundry, no writes to
// the world. It prints a report and writes a JSON of the classified rows beside the input.
//
// Usage: node tools/classify-corpus.mjs <corpus.json> [--list <family>] [--kind race|class|subclass|feat|spell]
import { readFileSync, writeFileSync } from 'node:fs';
import * as R from '../scripts/decide/registry.js';

const file = process.argv[2];
if (!file) { console.error('usage: node tools/classify-corpus.mjs <corpus.json>'); process.exit(2); }
const listFamily = process.argv.includes('--list') ? process.argv[process.argv.indexOf('--list') + 1] : null;
const onlyKind = process.argv.includes('--kind') ? process.argv[process.argv.indexOf('--kind') + 1] : null;
const raw = JSON.parse(readFileSync(file, 'utf8'));

// ---- the 2024 corpus: premium packs first, the SRD 2024 packs as their subset, legacy dropped
const PACK_RANK = {
  'dnd-players-handbook.classes': 1, 'dnd-players-handbook.feats': 1, 'dnd-players-handbook.origins': 1,
  'dnd-players-handbook.spells': 1, 'dnd-heroes-faerun.options': 1, 'dnd-dungeon-masters-guide.equipment': 1,
  'dnd5e.classes24': 2, 'dnd5e.feats24': 2, 'dnd5e.origins24': 2, 'dnd5e.spells24': 2,
};
const rows2024 = raw.rows.filter(r => PACK_RANK[r.pack]);
// dedupe by (kind, name): keep the best-ranked pack's copy
const byKey = new Map();
for (const r of rows2024) {
  const k = `${r.itemType}:${r.featType ?? ''}:${r.name.toLowerCase()}`;
  const have = byKey.get(k);
  if (!have || PACK_RANK[r.pack] < PACK_RANK[have.pack]) byKey.set(k, r);
}
const rows = [...byKey.values()];

// ---- ownership: which class / subclass / race grants each feature
const grantOwner = new Map();
for (const o of raw.owners) {
  if (!PACK_RANK[o.pack]) continue;
  for (const g of o.grants) grantOwner.set(g.uuid, { owner: o, level: g.level, choice: g.choice });
}
function ownerOf(r) {
  // the premium and SRD copies of a feature are different uuids; try the row's own uuid, then
  // any same-named row's uuid in the 2024 packs
  const direct = grantOwner.get(r.uuid);
  if (direct) return direct;
  for (const other of rows2024) {
    if (other.name === r.name && other.itemType === r.itemType && grantOwner.has(other.uuid)) return grantOwner.get(other.uuid);
  }
  return null;
}

// ---- the sweep's kinds: (a) race (b) class (c) subclass (d) feat (e) spell
function kindOf(r) {
  if (r.itemType === 'spell') return 'spell';
  if (r.featType === 'race') return 'race';
  if (r.featType === 'feat' || r.featType === 'origin') return 'feat';
  if (r.featType === 'supernaturalGift') return 'gift';
  const o = ownerOf(r);
  if (o?.owner.type === 'subclass') return 'subclass';
  if (o?.owner.type === 'class') return 'class';
  return 'class?';   // a class-typed feature nothing grants (an option a feature offers, e.g. an Invocation, a Metamagic, a Maneuver)
}

// ---- the families, each a mechanism the table already has or would need. Order matters: a
// row lands in EVERY family that matches — a feature is often two things at once.
const T = (r) => r.text;
const FAMILIES = [
  // what the module ALREADY does, family by family
  ['bend-attack',  'attack-roll Advantage/Disadvantage the gate reads (EFFECT_BENDS)',
    t => /\b(advantage|disadvantage) on (an |the |your |its |all |every )?(next )?(melee |ranged |spell |weapon )?attack rolls?\b/i.test(t) || /attack rolls? (made )?against (you|it|the target|that creature|the creature)s? (have|has|are made with) (advantage|disadvantage)/i.test(t)],
  ['bend-save',    'saving-throw Advantage/Disadvantage/auto-fail the save gate reads (SAVE_BENDS)',
    t => /\b(advantage|disadvantage) on (a |the |your |its |all |every |any )?(\w+ )?saving throws?\b/i.test(t) || /automatically (fails?|succeeds?)/i.test(t)],
  ['rider-damage', 'extra damage riding a hit (RIDERS, CLOCK_RIDERS, SNEAK_ATTACK)',
    t => /\b(extra|additional) (\d*d\d+|damage)\b/i.test(t) || /deals? an extra/i.test(t) || /\bdamage (increases|is increased) by\b/i.test(t)],
  ['clock',        'reads the combat clock — first round, has not acted, once per turn, until the start/end of a turn',
    t => /first round|hasn.t taken a turn|has not taken a turn|before it (has )?acted|once (per|on each of your) turn|only once per turn|until the (start|end) of (your|its|the target.s|the creature.s) next turn|until the end of (your|the current|this) turn/i.test(t)],
  ['interrupt',    'a Reaction that bends AC or damage after the verdict (INTERRUPT list)',
    (t, r) => (r.activation === 'reaction' || r.activities.some(a => a.activation === 'reaction')) && /\b(reduce|halve|half|bonus to (your |its )?ac|to your ac|the attack (roll )?(misses|to miss)|no damage|prevent|negat)/i.test(t)],
  ['reaction',     'any Reaction-cost ability (the Reaction chip spends it)',
    (t, r) => r.activation === 'reaction' || r.activities.some(a => a.activation === 'reaction') || /\btake a reaction\b|\bas a reaction\b|\byour reaction\b/i.test(t)],
  ['use-chip',     'a use that arms the NEXT attack/roll or lasts to the end of the turn (USE_CHIPS)',
    t => /\b(next|the next time you) (attack|hit|make an attack|make a d20|roll)|\bbefore the end of (your|this|the current) turn\b|\buntil the end of (your|this|the current) turn\b/i.test(t)],
  ['press-condition', 'a failed save or a hit presses a condition on the target (SAVE_PRESSES / effect riders)',
    t => /\b(on a failed save|fails? the save|must succeed on a \w+ saving throw|or (it|the target) (has|gains) the \w+ condition|has the \w+ condition)\b/i.test(t)],
  ['half-on-save', 'half damage on a successful save; none/half (Evasion-shaped)',
    (t, r) => r.activities.some(a => a.save?.onSave === 'half') || /half as much damage|takes? half (the )?damage|no damage (if|on a successful)/i.test(t)],
  ['d20-fold',     'a die or bonus folded into a d20 roll after the fact (D20 folds: reroll, add a d4/d6/d10, Bardic, Heroic)',
    t => /\breroll\b|roll (it|the d20|the die|the attack roll) again|\badd (a |the |an )?d\d+\b|\badd (the number|it) to\b|bonus to (the |an |that )?(attack roll|saving throw|ability check|d20 test)/i.test(t)],
  ['crit',         'critical-hit rules — wider crit range, extra dice on a crit, or a crit forced',
    t => /critical hit/i.test(t)],
  ['concentration','touches concentration',
    t => /concentration/i.test(t)],
  ['volley',       'many attack/damage beams aimed separately (VOLLEY)',
    t => /\b(beams?|darts?|rays?|bolts?) /i.test(t) && /\b(each|separately|same target or different)\b/i.test(t)],
  ['temp-hp',      'temporary hit points or healing on a hit / a kill',
    t => /temporary hit points|regain(s)? (\d+ |a number of )?hit points/i.test(t)],
  ['aura',         'an aura — creatures within N feet of you get a bend, resistance or bonus',
    t => /within \d+ feet of you\b.*\b(advantage|disadvantage|resistance|bonus|immun|can.t|cannot)/i.test(t)],
  ['resist',       'resistance / immunity to a damage type (the system already applies these from effects)',
    t => /\b(resistance|immunity|immune) to\b/i.test(t)],
  ['movement',     'speed / movement / opportunity-attack rules (mostly out of scope)',
    t => /opportunity attack|your speed|speed (increases|is increased)|difficult terrain|move up to/i.test(t)],
  ['ac-passive',   'a standing AC formula (Unarmored Defense) — the sheet already does it',
    t => /\barmor class (equals|is|becomes)|base ac/i.test(t)],
];

function classify(r) {
  const t = T(r);
  const fams = FAMILIES.filter(([, , test]) => test(t, r)).map(([k]) => k);
  const struct = {
    effects: r.effects.length,
    passive: r.effects.filter(e => e.transfer).length,
    applied: r.effects.filter(e => !e.transfer).length,
    statuses: [...new Set(r.effects.flatMap(e => e.statuses))],
    activities: [...new Set(r.activities.map(a => a.type))],
    save: r.activities.some(a => a.save),
    attack: r.activities.some(a => a.attack),
    damage: r.activities.some(a => a.damageParts.length),
    uses: !!(r.uses || r.activities.some(a => a.uses)),
    activation: r.activation ?? '',
    textOnly: !r.effects.length && !r.activities.some(a => a.save || a.attack || a.damageParts.length || a.healing),
  };
  return { fams, struct };
}

// ---- what the registry already names
const known = new Map();
const add = (name, where) => { const k = name.toLowerCase(); known.set(k, [...(known.get(k) ?? []), where]); };
for (const k of Object.keys(R.EFFECT_BENDS)) { add(k, 'EFFECT_BENDS'); const from = R.EFFECT_BENDS[k].from; if (from) for (const f of from.split(/,\s*/)) add(f.replace(/\s*\(.*\)$/, ''), 'EFFECT_BENDS.from'); }
for (const r of Object.values(R.CLOCK_RIDERS)) add(r.feature, 'CLOCK_RIDERS');
for (const k of Object.keys(R.USE_CHIPS)) add(k, 'USE_CHIPS');
for (const k of Object.keys(R.SAVE_PRESSES)) add(k, 'SAVE_PRESSES');
for (const o of Object.values(R.CUNNING_OPTIONS)) add(o.feature, 'CUNNING_OPTIONS');
add(R.SNEAK_ATTACK.feature ?? 'Sneak Attack', 'SNEAK_ATTACK'); add('Evasion', 'EVASION'); add('Death Strike', 'DEATH_STRIKE');
for (const [spec, s] of Object.entries(R.LIST_SPECS)) {
  if (typeof s.default !== 'string') continue;
  for (const chunk of s.default.split(/,\s*/)) add(chunk.split(':')[0].trim(), `LIST:${spec}`);
}
for (const n of ['Magic Missile', 'Scorching Ray', 'Eldritch Blast', 'Steel Wind Strike']) add(n, 'VOLLEY');
for (const n of ['Hunter\'s Mark', 'Hex']) add(n, 'RIDER');
for (const n of ['Vex', 'Sap', 'Cleave', 'Slow', 'Topple', 'Push', 'Graze', 'Nick']) add(n, 'MASTERY');
function knownWhere(r) {
  const hits = known.get(r.name.toLowerCase()) ?? [];
  return hits.length ? [...new Set(hits)] : null;
}

// ---- classify everything
const out = rows.map(r => {
  const { fams, struct } = classify(r);
  const o = ownerOf(r);
  return {
    kind: kindOf(r), name: r.name, pack: r.pack, level: r.itemType === 'spell' ? r.level : (o?.level ?? r.prereqLevel ?? null),
    owner: o ? o.owner.name : null, school: r.school, fams, struct, known: knownWhere(r),
    text: r.text.slice(0, 300),
  };
});
writeFileSync(file.replace(/\.json$/, '-classified.json'), JSON.stringify(out, null, 2));

// ---- the report
const KINDS = ['race', 'class', 'subclass', 'class?', 'feat', 'gift', 'spell'];
const pick = onlyKind ? out.filter(x => x.kind === onlyKind) : out;
const combatish = x => x.fams.length > 0;
console.log(`# corpus (2024 packs, deduped): ${out.length} rows — ${KINDS.map(k => `${k} ${out.filter(x => x.kind === k).length}`).join(', ')}`);
console.log(`# with at least one family: ${out.filter(combatish).length}; text-only among those: ${out.filter(x => combatish(x) && x.struct.textOnly).length}; already named in the registry: ${out.filter(x => x.known).length}`);
console.log('\n## families × kinds (rows matching; a row can be in several)');
console.log(`${'family'.padEnd(16)} ${KINDS.map(k => k.padStart(9)).join('')}   textOnly  known   ${'meaning'}`);
for (const [k, meaning] of FAMILIES) {
  const hit = out.filter(x => x.fams.includes(k));
  console.log(`${k.padEnd(16)} ${KINDS.map(kd => String(hit.filter(x => x.kind === kd).length).padStart(9)).join('')}   ${String(hit.filter(x => x.struct.textOnly).length).padStart(8)}  ${String(hit.filter(x => x.known).length).padStart(5)}   ${meaning}`);
}
console.log('\n## structure of the combat-ish rows');
const c = pick.filter(combatish);
const n = (f) => c.filter(f).length;
console.log(`  ships an effect: ${n(x => x.struct.effects)}  (passive/transfer ${n(x => x.struct.passive)}, applied-to-target ${n(x => x.struct.applied)})`);
console.log(`  activity with a save: ${n(x => x.struct.save)}  attack: ${n(x => x.struct.attack)}  damage: ${n(x => x.struct.damage)}  uses: ${n(x => x.struct.uses)}`);
console.log(`  activation — ${['action', 'bonus', 'reaction', 'special', ''].map(a => `${a || 'none'} ${n(x => x.struct.activation === a)}`).join(', ')}`);
console.log(`  TEXT-ONLY (no effect, no save/attack/damage activity): ${n(x => x.struct.textOnly)}`);

if (listFamily) {
  console.log(`\n## ${listFamily}${onlyKind ? ` (${onlyKind})` : ''}`);
  for (const kd of KINDS) {
    const hit = pick.filter(x => x.kind === kd && x.fams.includes(listFamily));
    if (!hit.length) continue;
    console.log(`\n### ${kd} (${hit.length})`);
    for (const x of hit.sort((a, b) => (a.owner ?? '').localeCompare(b.owner ?? '') || (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name))) {
      const s = x.struct;
      const tag = [s.effects ? `fx${s.effects}${s.statuses.length ? `[${s.statuses.join(',')}]` : ''}` : '', s.save ? 'save' : '', s.attack ? 'atk' : '', s.damage ? 'dmg' : '', s.uses ? 'uses' : '', s.activation, s.textOnly ? 'TEXT' : ''].filter(Boolean).join(' ');
      console.log(`  ${(x.owner ? `${x.owner} ${x.level ?? ''}`.trim() : (x.kind === 'spell' ? `L${x.level}` : '')).padEnd(24)} ${x.name.padEnd(36)} ${(x.known ? '✓ ' + x.known.join('/') : '').padEnd(24)} {${tag}} ${x.fams.filter(f => f !== listFamily).join(',')}`);
    }
  }
}
