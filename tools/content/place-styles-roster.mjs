// Place the BF Styles walk roster on Party Camp (the fighting styles walk, HANDOFF.md §1, 2026-09-26).
// Linked tokens, friendly; the melee fighters around the west Practice Dummy, the thrower three
// squares from the east one, the two guards beside Gren. Idempotent: an existing token of the same
// actor on the scene is moved, not duplicated. A content tool, not a suite — it asserts nothing.
import { connectSuite } from '../harness.mjs';

const f = await connectSuite({ tag: 'place-styles', watchdogMs: 120_000 });
const out = await f.evaluate(async () => {
  const scene = game.scenes.getName('Party Camp');
  if (!scene) return { error: 'no Party Camp' };
  const g = scene.grid.size;
  const west = scene.tokens.find(t => t.name === 'Practice Dummy' && t.x < 2000);
  const east = scene.tokens.find(t => t.name === 'Practice Dummy' && t.x > 3000);
  const gren = scene.tokens.find(t => t.name === 'Gren');
  if (!west || !east || !gren) return { error: 'a Dummy or Gren is missing on Party Camp' };
  const spots = {
    'BF Style GWF': [west.x - g, west.y],
    'BF Style Dueling': [west.x + g, west.y],
    'BF Style Defense': [west.x, west.y - g],
    'BF Style TWF': [west.x, west.y + g],
    'BF Style Unarmed': [west.x - g, west.y - g],
    'BF Style Blind': [west.x + g, west.y + g],
    'BF Style Thrown': [east.x - 3 * g, east.y],
    'BF Style Protection': [gren.x - g, gren.y],
    'BF Style Interception': [gren.x, gren.y - g]
  };
  const done = [];
  for (const [name, [x, y]] of Object.entries(spots)) {
    const actor = game.actors.getName(name);
    if (!actor) { done.push(`${name}: MISSING`); continue; }
    const have = scene.tokens.find(t => t.actorId === actor.id);
    if (have) { await have.update({ x, y }, { animate: false }); done.push(`${name}: moved`); continue; }
    await scene.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(actor.prototypeToken.toObject(),
      { x, y, actorId: actor.id, actorLink: true, disposition: 1 }, { inplace: false })]);
    done.push(`${name}: placed at ${x},${y}`);
  }
  return { done };
}, null);
console.log(JSON.stringify(out, null, 2));
await f.disconnect?.();
process.exit(out?.error ? 1 : 0);
