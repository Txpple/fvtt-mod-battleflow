// Audit the curated Reaction List world setting against the world's ACTUAL items.
//
// WHY: `reactionACBonus` (ui.js) reads a numeric `system.attributes.ac.bonus` change off the
// reaction's own effect. When it finds none it returns null, and `holdWouldMatter` (hold.js)
// then returns TRUE — "unmeasurable bonus, ask the human". That default is right for a
// proficiency-scaled AC boost like Defensive Duelist, but for an entry that is not an AC
// boost AT ALL (Riposte makes an attack; Parry reduces damage) it means the module offers a
// hold that cannot possibly help, every single time its owner is hit.
//
// Prints, per entry: who has it, whether an AC-bonus change resolves, and enough of the
// description to classify it. Read-only — changes nothing.
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
setTimeout(() => { console.error('[audit] WATCHDOG 240s'); process.exit(3); }, 240_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
console.log('[audit] connected');

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const strip = h => (h ?? '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const raw = game.settings.get(MOD, 'interruptList') ?? '';
  const entries = raw.split(',').map(c => {
    const [name, kind] = c.split(':').map(x => x?.trim());
    return { name, kind: (kind?.toLowerCase() === 'damage') ? 'damage' : 'ac',
      declared: kind?.trim() ?? '(none → defaults to ac)' };
  }).filter(e => e.name);

  const rows = [];
  for (const e of entries) {
    const holders = [];
    for (const actor of game.actors) {
      const item = actor.items.find(i => i.name?.toLowerCase() === e.name.toLowerCase());
      if (!item) continue;
      let acBonus = null, anyACChange = null;
      for (const eff of item.effects ?? []) {
        for (const ch of eff.changes ?? []) {
          if (ch.key !== 'system.attributes.ac.bonus') continue;
          anyACChange = String(ch.value);
          const v = Number(ch.value);
          if (Number.isFinite(v)) acBonus = v;
        }
      }
      holders.push({
        actor: actor.name, hasPlayerOwner: !!actor.hasPlayerOwner,
        effects: item.effects?.size ?? 0, acBonus, anyACChange,
        activation: item.system?.activation?.type ?? null
      });
    }
    // ⚠ Judge on the BEST holder, never holders[0]. "Shield" matches both the spell and the
    // shield ARMOUR item, and the armour sorts first on some actors — sampling it reported the
    // spell as an unmeasurable bonus and slandered a correctly-configured entry. The real path
    // does not have this problem: findInterrupt passes itemId/activityId into reactionItem, so
    // it resolves the item it actually matched. This is an audit-only hazard.
    const sample = holders.find(h => h.acBonus != null)
      ?? holders.find(h => h.activation === 'reaction')
      ?? holders[0];
    let desc = '';
    for (const actor of game.actors) {
      const item = actor.items.find(i => i.name?.toLowerCase() === e.name.toLowerCase());
      if (item) { desc = strip(item.system?.description?.value).slice(0, 220); break; }
    }
    rows.push({ ...e, holders, desc, resolvesBonus: sample?.acBonus ?? null,
      anyReactionHolder: holders.some(h => h.activation === 'reaction') });
  }

  // v1.19.0 — the Maneuver Folds list gets the same walk: for each entry, who holds the item,
  // does its first activity resolve a die formula, and can the pool pay for it. A listed name
  // nobody holds is inert (costs nothing); a holder with no formula is a misconfiguration the
  // fold would silently skip.
  const rawFolds = game.settings.get(MOD, 'maneuverFolds') ?? '';
  const foldRows = [];
  for (const chunk of rawFolds.split(',').map(c => c.trim()).filter(Boolean)) {
    const [name, kind] = chunk.split(':').map(x => x?.trim());
    const holders = [];
    for (const actor of game.actors) {
      const item = actor.items.find(i => i.name?.toLowerCase() === name?.toLowerCase());
      if (!item) continue;
      const act = item.system.activities?.contents?.[0] ?? null;
      const formula = act?.roll?.formula || act?.damage?.parts?.[0]?.formula || null;
      const pools = (act?.consumption?.targets ?? [])
        .filter(t => t.type === 'itemUses')
        .map(t => {
          const pool = t.target ? actor.items.get(t.target) : item;
          return pool ? `${pool.name} ${pool.system.uses?.value ?? '?'}/${pool.system.uses?.max ?? '?'}` : '(missing pool!)';
        });
      holders.push({ actor: actor.name, hasPlayerOwner: !!actor.hasPlayerOwner,
        activityType: act?.type ?? null, activation: act?.activation?.type ?? null,
        formula, pools });
    }
    foldRows.push({ chunk, name, kind: kind?.toLowerCase() ?? '(none)', holders,
      kindKnown: ['precision', 'riposte'].includes(kind?.toLowerCase()) });
  }
  return { raw, rows, rawFolds, foldRows };
});

console.log(`\n[audit] Reaction List setting:\n  ${out.raw}\n`);
console.log('='.repeat(100));
for (const r of out.rows) {
  const held = r.holders.length;
  console.log(`\n${r.name}   [declared kind: ${r.declared}]`);
  if (!held) { console.log('   — nobody in this world has an item by that name (inert entry)'); continue; }
  for (const h of r.holders) {
    console.log(`   held by ${h.actor}${h.hasPlayerOwner ? ' (PC)' : ''} · effects=${h.effects}`
      + ` · activation=${h.activation} · ac.bonus change=${h.anyACChange ?? 'NONE'}`);
  }
  const verdict = (r.kind === 'ac')
    ? (r.resolvesBonus != null
        ? `OK — numeric +${r.resolvesBonus}, the hopeless-hold skip can do its job`
        : (r.anyReactionHolder
            ? 'null bonus, but IS a reaction — expected for a scaled boost (Defensive Duelist); asks the human'
            : 'NOT AN AC BOOST AT ALL → null bonus → OFFERED ON EVERY HIT. Miscategorised.'))
    : 'damage kind — always offered by design (it always reduces something)';
  console.log(`   verdict: ${verdict}`);
  if (r.desc) console.log(`   text: "${r.desc}"`);
}
console.log('\n' + '='.repeat(100));

console.log(`\n[audit] Maneuver Folds setting (v1.19.0):\n  ${out.rawFolds}\n`);
console.log('='.repeat(100));
for (const r of out.foldRows) {
  console.log(`\n${r.name}   [kind: ${r.kind}${r.kindKnown ? '' : ' — UNKNOWN, the strict parser DROPS this entry'}]`);
  if (!r.holders.length) { console.log('   — nobody in this world has an item by that name (inert entry)'); continue; }
  for (const h of r.holders) {
    console.log(`   held by ${h.actor}${h.hasPlayerOwner ? ' (PC)' : ''} · activity=${h.activityType}`
      + ` · activation=${h.activation ?? '(none)'} · die=${h.formula ?? 'NONE — the fold would skip this holder'}`
      + (h.pools.length ? ` · pool: ${h.pools.join(', ')}` : ' · no consumption'));
  }
}
console.log('\n' + '='.repeat(100));
process.exit(0);
