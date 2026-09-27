// Standing drift check: the verbatim rule line (ARCHITECTURE.md §5 law 8: a popup quotes the
// feature's own 2024 text from the world's compendium). Reads the weapon mastery rule text off the
// system's references (CONFIG.DND5E.weaponMasteries[*].reference) and the canonical Prone status the
// presses land. RULE_TEXT / MASTERY_RULES in decide/registry.js must match VERBATIM (the source mixes
// curly and straight apostrophes). Read-only, no preflight. Run after any dnd5e upgrade.
//
//   node tools/check-mastery-rules.mjs
import { Foundry, loadEnv } from 'fvtt-mcp-dnd5e/client';
import { foundryConfig } from './target.mjs';

const env = loadEnv();
setTimeout(() => { console.error('[masteryrules] WATCHDOG 240s'); process.exit(3); }, 240_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
console.log('[masteryrules] connected — read only');

const out = await f.evaluate(async () => {
  const masteries = {};
  for (const [key, cfg] of Object.entries(CONFIG.DND5E.weaponMasteries ?? {})) {
    let text = null, err = null;
    try {
      const ref = cfg.reference ?? null;
      if (!ref) err = 'no reference on CONFIG';
      const page = ref ? await fromUuid(ref) : null;
      text = page?.text?.content ?? null;
      if (ref && !page) err = 'reference did not resolve';
    } catch (e) { err = e.message; }
    masteries[key] = { label: cfg.label ?? key, reference: cfg.reference ?? null, text, err };
  }
  const prone = CONFIG.statusEffects.find(s => s.id === 'prone') ?? null;
  return {
    masteries,
    prone: prone ? { name: prone.name, img: prone.img, _id: prone._id ?? null } : null,
    system: game.system.version
  };
});

// Tags out, entities decoded, enricher syntax down to its label; apostrophes UNTOUCHED.
const strip = html => String(html ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/&Reference\[[^\]]*\]\{([^}]*)\}/g, '$1')
  .replace(/&Reference\[[^\]]*\]/g, m => /\[([^\]]*)\]/.exec(m)?.[1] ?? m)
  .replace(/@UUID\[[^\]]*\]\{([^}]*)\}/g, '$1')
  .replace(/\[\[\/[^\]]*\]\]\{([^}]*)\}/g, '$1')
  .replace(/\s+/g, ' ').trim();

console.log(`\n[masteryrules] dnd5e ${out.system}; canonical prone = ${JSON.stringify(out.prone)}\n`);
for (const [key, m] of Object.entries(out.masteries)) {
  console.log(`--- ${key} (${m.label})${m.err ? `  ⚠ ${m.err}` : ''}`);
  if (m.reference) console.log(`    ref: ${m.reference}`);
  console.log(`    ${strip(m.text) || '<no text>'}`);
}
process.exit(0);
