// Survey every reaction-cost item in the world's compendia, so the curated interrupt list
// in design.md §5 is built from what this table can actually encounter rather than memory.
// Writes raw JSON to scratchpad; classification happens afterwards against the text.
import { readFileSync, writeFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[scan] WATCHDOG 600s'); process.exit(3); }, 600_000);

const f = new Foundry({
  serverUrl: env.MOLTEN_SERVER_URL, magicUrl: env.MOLTEN_MAGIC_URL,
  user: env.FOUNDRY_USER || 'Claude', password: env.FOUNDRY_PASSWORD,
  adminKey: env.MOLTEN_ADMIN_KEY, worldId: env.MOLTEN_WORLD_ID,
});
console.log('[scan] connecting…');
await f.connect();
console.log('[scan] connected');

const result = await f.evaluate(async () => {
  const strip = html => (html ?? '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const rows = [];
  const errors = [];
  const packStats = [];

  for (const pack of game.packs) {
    if (pack.documentName !== 'Item') continue;
    if (pack.metadata.id.startsWith('JB2A') || pack.metadata.id.startsWith('dnd5e-animations')) continue;
    try {
      const index = await pack.getIndex({
        fields: ['type', 'system.activities', 'system.activation', 'system.level', 'system.method',
          'system.description.value'],
      });
      let hits = 0;
      for (const entry of index) {
        const activities = entry.system?.activities ?? {};
        const list = Array.isArray(activities) ? activities : Object.values(activities);
        // ⚠ An activity only carries its OWN activation when activation.override is true;
        // otherwise it INHERITS the item's (data/activity/_types.mjs:15 "Override activation
        // values inferred from item"). Spells keep casting time at item level, so an
        // activities-only scan silently misses every reaction spell — Shield included.
        // UNION of both signals. Raw compendium source has no data preparation applied, so
        // neither signal alone is complete: spells carry casting time at ITEM level (an
        // activities-only scan misses Shield), while many class features set it on the
        // activity itself (an item-only scan misses Uncanny Dodge). Over-select here and
        // let the classification pass below cut it down.
        const ownReaction = list.find(a => a?.activation?.type === 'reaction');
        const itemIsReaction = entry.system?.activation?.type === 'reaction';
        const reaction = ownReaction ?? (itemIsReaction ? list[0] : null);
        if (!ownReaction && !itemIsReaction) continue;
        hits++;
        rows.push({
          pack: pack.metadata.id,
          name: entry.name,
          itemType: entry.type,
          level: entry.system?.level ?? null,
          method: entry.system?.method ?? null,
          activityType: reaction?.type ?? null,
          source: ownReaction ? 'activity' : 'item',
          condition: strip(reaction?.activation?.condition || entry.system?.activation?.condition).slice(0, 220),
          text: strip(entry.system?.description?.value).slice(0, 700),
        });
      }
      packStats.push({ pack: pack.metadata.id, indexed: index.size ?? index.length ?? 0, reactions: hits });
    } catch (err) {
      errors.push({ pack: pack.metadata.id, error: String(err?.message || err) });
    }
  }
  return { rows, errors, packStats };
}, null);

const out = 'C:/Users/sippelmc/AppData/Local/Temp/claude/D--Workbench-FVTT-Repos-fvtt-mod-battleflow/d9db5525-972f-4d65-b16b-fb7bf4f6d994/scratchpad/reactions-raw.json';
writeFileSync(out, JSON.stringify(result, null, 2));
console.log('\n# pack coverage');
for (const p of result.packStats) console.log(`  ${p.pack}: ${p.indexed} indexed, ${p.reactions} reaction-cost`);
if (result.errors.length) {
  console.log('\n# errors');
  for (const e of result.errors) console.log(`  ${e.pack}: ${e.error}`);
}
console.log(`\n# total reaction-cost items: ${result.rows.length}`);
console.log(`written: ${out}`);
await f.disconnect?.();
process.exit(0);
