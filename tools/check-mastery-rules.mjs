// STANDING DRIFT CHECK — the verbatim rule line (ARCHITECTURE.md §5 law 8: a popup
// describing a feature quotes that feature's own 2024 text, read from the world's own
// compendium).
//
// Reads the weapon mastery RULE TEXT off the SYSTEM's own references
// (CONFIG.DND5E.weaponMasteries[*].reference → rules journal page), plus the canonical
// Prone status (name/img/_id) the bash/topple press lands. Read-only, no preflight — safe
// beside a live session. The RULE_TEXT / MASTERY_RULES constants in decide/registry.js
// must match this output VERBATIM (punctuation included — the source mixes
// curly and straight apostrophes). Run it after any dnd5e system upgrade.
//
//   node tools/probe-mastery-rules.mjs
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

// Tags out, entities decoded, enricher syntax down to its label — apostrophes UNTOUCHED
// (the constants must copy what the source actually uses, curly or straight).
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
