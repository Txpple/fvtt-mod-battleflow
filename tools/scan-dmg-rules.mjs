// The DMG's rules chapters: every JournalEntry page in the DMG module's journal packs, with the mechanism words its
// text carries (a save, Advantage/Disadvantage, a condition, damage, a to-hit or AC change). Read-only, offline output.
import { writeFileSync } from 'node:fs';
import { connectSuite } from './harness.mjs';

const out = process.argv[2] ?? 'dist/dmg-rules-scan.json';
const f = await connectSuite({ tag: 'scandmg', watchdogMs: 600000 });
const rows = await f.evaluate(async () => {
  const WORDS = {
    save: /saving throw|save\b/i, adv: /\badvantage\b/i, dis: /\bdisadvantage\b/i, damage: /\bdamage\b/i, ac: /\bArmor Class\b|\bAC\b/, attack: /attack roll/i,
    cover: /\bcover\b/i, condition: /\b(Blinded|Charmed|Deafened|Exhaustion|Frightened|Grappled|Incapacitated|Invisible|Paralyzed|Petrified|Poisoned|Prone|Restrained|Stunned|Unconscious)\b/,
    initiative: /\binitiative\b/i, concentration: /\bconcentration\b/i, hp: /hit points?/i, death: /death saving/i, crit: /critical hit/i
  };
  const rows = [];
  for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-dungeon-masters-guide') && (p.documentName === 'JournalEntry'))) {
    const docs = await pack.getDocuments();
    for (const j of docs) {
      for (const page of j.pages) {
        const html = page.text?.content ?? '';
        const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        const hits = Object.entries(WORDS).filter(([, re]) => re.test(text)).map(([k]) => k);
        rows.push({ pack: pack.collection, journal: j.name, page: page.name, chars: text.length, hits, snippet: text.slice(0, 160) });
      }
    }
  }
  return rows;
}, null);
writeFileSync(out, JSON.stringify(rows, null, 1));
const withMech = rows.filter(r => r.hits.length);
console.log(`${rows.length} pages, ${withMech.length} with a mechanism word -> ${out}`);
for (const r of withMech.sort((a, b) => b.hits.length - a.hits.length)) console.log(`${r.hits.length}  ${r.journal} / ${r.page}  [${r.hits.join(',')}]`);
await f.dispose();
process.exit(0);
