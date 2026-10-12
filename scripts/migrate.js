/**
 * By the Books — THE RENAME'S MIGRATION (3.0.0; formerly Battle Flow, `fvtt-mod-battleflow`). Foundry
 * cannot rename a package, so a world installs this one beside the old and this file carries the old
 * one's state over: the legacy flag scope on standing documents, the emanation behaviours' subtype,
 * the world settings, and each client's own settings. The arithmetic is decide/migrate.js; this file
 * reads the world and writes what it says.
 *
 *   - init, EVERY client: the client-scope settings copied in localStorage before anything reads them.
 *   - ready, the ACTIVE GM: every world Actor and its Items and effects, world Items, Scenes with their
 *     Tokens (an unlinked token's delta too), Regions and region behaviours, Combats and Combatants,
 *     Users — the legacy scope moved under the new id; the world settings copied and the old Setting
 *     deleted. Chat messages are never touched: an old card keeps its old scope for good, and every
 *     read falls back to it (core.js `readFlag`). Idempotent: it scans every load, and the second load
 *     finds nothing and says nothing.
 *   - Every write carries the migration mark, and the dispatcher drops the document hooks it raises
 *     on every client (scripts/dispatch.js), so a moved flag is never mistaken for a moment.
 *   - THE COEXISTENCE GUARD: with the old package still enabled this module is passive (the dispatcher
 *     runs almost nothing, scripts/dispatch.js `PASSIVE_KEEPS`), nothing here moves, and the GM is told
 *     once. The question is asked here because the legacy id lives in core.js.
 */
import { MODULE_ID, LEGACY_ID, TITLE, S, isActiveGM } from "./core.js";
import { scopeMoves, scopeMove, behaviorMove, behaviorType, settingMoves, clientCopies, summaryLine, MIGRATED_FROM } from "./decide/migrate.js";
import { listen, listenOnce, setPassiveGate, isPassive, MIGRATION_MARK } from "./dispatch.js";

/** The old package's title, for the words only. */
const LEGACY_TITLE = "Battle Flow";
const IDS = Object.freeze({ from: LEGACY_ID, to: MODULE_ID });
/** Every migration write's options: the dispatcher drops the hooks a write carrying it raises. */
const MARK = () => ({ [MIGRATION_MARK]: true });

const PASSIVE_WARNING = "By the Books is the new name of Battle Flow, which is still enabled in this world. "
  + "Disable Battle Flow and reload; By the Books then moves your settings and standing effects over.";

setPassiveGate(() => !!game.modules.get(LEGACY_ID)?.active);

/* --- init, every client: the client-scope settings -------------------------------------------- */

/** How many client settings this client copied at init — the GM's count joins the summary. */
let clientCopied = 0;

listenOnce("init", "migrate", () => {
  let store = null;
  try { store = globalThis.localStorage ?? null; } catch { /* storage blocked */ }
  if ( !store ) return;
  for ( const [, to, value] of clientCopies(Object.values(S), k => store.getItem(k), IDS) ) {
    try { store.setItem(to, value); clientCopied++; }
    catch(err) { console.warn(`${TITLE} | Could not copy the client setting ${to} from ${LEGACY_TITLE}.`, err); }
  }
});

/* --- ready, the active GM: the world ---------------------------------------------------------- */

listenOnce("ready", "migrate", () => {
  if ( isPassive() ) {
    console.warn(`${TITLE} | ${PASSIVE_WARNING}`);
    if ( game.user?.isGM ) ui.notifications?.warn(PASSIVE_WARNING, { permanent: true });
    return;
  }
  if ( !isActiveGM() ) return;
  void migrateWorld();
});
// ⚠ At `ready` the joining GM is not always flagged active yet (settings.js says the same): when this
// client's own activity lands, the move runs then. It runs once per load either way.
listen("userConnected", "migrate", (user, active) => {
  if ( !active || !user?.isSelf ) return;
  if ( !isActiveGM() ) return;
  void migrateWorld();
});

let started = false;

/**
 * One step, on its own: a failure is logged and the next step runs (one bad document must not stop
 * the combats and the users behind it on every later load).
 * @param {string} what
 * @param {() => Promise<any>} fn
 */
async function step(what, fn) {
  try { await fn(); }
  catch(err) { console.error(`${TITLE} | The move from ${LEGACY_TITLE} could not finish ${what}; the rest goes on, and the next load tries again.`, err); }
}

/** Move everything; one summary when anything moved. */
async function migrateWorld() {
  if ( started ) return;
  started = true;
  const counts = { settings: clientCopied };
  const filled = [];
  await step("the world settings", async () => { counts.settings += await moveSettings(); });
  await step("the actors", () => moveActors(counts, filled));
  await step("the world items", () => moveItems(game.items, counts, filled));
  await step("the scenes", () => moveScenes(counts, filled));
  await step("the combats", () => moveCombats(counts, filled));
  await step("the users", () => batch([...game.users], u => getDocumentClass("User").updateDocuments(u, MARK()),
    "users", counts, filled, "world"));
  if ( filled.length ) {
    console.warn(`${TITLE} | Where both flag scopes stood, the keys only ${LEGACY_TITLE}'s held were copied under the `
      + `new id and the old scope removed (the new one's own keys kept):\n  ${filled.join("\n  ")}`);
  }
  const line = summaryLine(counts, { title: TITLE, legacyTitle: LEGACY_TITLE });
  if ( !line ) return;
  // biome-ignore lint/suspicious/noConsole: the one record of what the rename's migration moved
  console.info(`${TITLE} | ${line}`);
  ui.notifications?.info(line);
  // The regions' standing effects are re-swept now their behaviours carry the new type.
  if ( counts.behaviors || counts.regions ) Hooks.callAll(`${MODULE_ID}.emanationsChanged`);
}

/**
 * One collection's scope moves, written in ONE call (a synthetic actor rebuilds its collections on
 * every write: batch per collection). Counted: only the documents whose old scope held a key.
 * @param {any[]} docs
 * @param {(updates: object[]) => Promise<any>} write
 * @param {string} kind  the summary's count key
 */
async function batch(docs, write, kind, counts, filled, where) {
  const { updates, carried, filled: kept } = scopeMoves(docs.map(d => d?._source ?? d), IDS);
  for ( const c of kept ) filled.push(`${where}: ${kind} ${c.id} — ${c.keys.join(", ")}`);
  if ( !updates.length ) return;
  await write(updates);
  if ( carried ) counts[kind] = (counts[kind] ?? 0) + carried;
}

/**
 * The world settings: every Setting stored under the legacy id is read. A key this module registers
 * is copied under the new id where it has none yet, and the old Setting deleted; a key it does not
 * register is left in place and logged.
 */
async function moveSettings() {
  const world = game.settings.storage.get("world");
  const all = [...(world?.contents ?? world ?? [])].map(doc => ({ key: doc.key, value: doc._source?.value ?? doc.value, doc }));
  const { moves, unregistered } = settingMoves(all, key => game.settings.settings.has(`${MODULE_ID}.${key}`), IDS);
  if ( unregistered.length ) {
    console.warn(`${TITLE} | Left ${LEGACY_TITLE}'s world settings that ${TITLE} does not register in place: ${unregistered.join(", ")}.`);
  }
  let moved = 0;
  for ( const { key, value } of moves ) {
    try {
      await game.settings.set(MODULE_ID, key, value, MARK());
      await all.find(s => s.key === `${LEGACY_ID}.${key}`)?.doc.delete(MARK());
      moved++;
    } catch(err) {
      console.warn(`${TITLE} | Could not move the setting ${key} from ${LEGACY_TITLE}.`, err);
    }
  }
  return moved;
}

/** Items and their effects, under one parent (an actor, synthetic or not) or the world's. */
async function moveItems(items, counts, conflicts, parent = null) {
  const list = [...(items ?? [])];
  const where = parent ? `${parent.name} (${parent.uuid})` : "world";
  await batch(list, u => (parent ? parent.updateEmbeddedDocuments("Item", u, MARK()) : Item.updateDocuments(u, MARK())),
    "items", counts, conflicts, where);
  for ( const item of list ) {
    await batch([...(item.effects ?? [])], u => item.updateEmbeddedDocuments("ActiveEffect", u, MARK()),
      "effects", counts, conflicts, item.uuid);
  }
}

/** Every world Actor, its Items, its own effects and its Items' effects. */
async function moveActors(counts, conflicts) {
  const actors = [...game.actors];
  await batch(actors, u => Actor.updateDocuments(u, MARK()), "actors", counts, conflicts, "world");
  for ( const actor of actors ) {
    await moveItems(actor.items, counts, conflicts, actor);
    await batch([...actor.effects], u => actor.updateEmbeddedDocuments("ActiveEffect", u, MARK()),
      "effects", counts, conflicts, actor.uuid);
  }
}

/**
 * An unlinked token's delta: only what the delta itself holds (its base actor's documents moved with
 * the world actors), written through the synthetic actor, one call per collection.
 */
export async function moveDelta(token, counts, conflicts) {
  const delta = token._source?.delta;
  const actor = token.actor;
  if ( token.actorLink || !delta || !actor ) return;
  const own = scopeMove(delta.flags, IDS);
  if ( own ) {
    await actor.update(own.update, MARK());
    if ( own.carried ) counts.actors = (counts.actors ?? 0) + 1;
    if ( own.filled.length ) conflicts.push(`${token.uuid}: delta — ${own.filled.join(", ")}`);
  }
  await batch(delta.items ?? [], u => actor.updateEmbeddedDocuments("Item", u, MARK()), "items", counts, conflicts, token.uuid);
  await batch(delta.effects ?? [], u => actor.updateEmbeddedDocuments("ActiveEffect", u, MARK()), "effects", counts, conflicts, token.uuid);
  for ( const src of delta.items ?? [] ) {
    if ( !src.effects?.length ) continue;
    const item = actor.items.get(src._id);
    if ( !item ) continue;
    await batch(src.effects, u => item.updateEmbeddedDocuments("ActiveEffect", u, MARK()), "effects", counts, conflicts, item.uuid);
  }
}

/** Every Scene: its flags, its Tokens (and their deltas), its Regions and their behaviours. */
async function moveScenes(counts, conflicts) {
  const scenes = [...game.scenes];
  await batch(scenes, u => Scene.updateDocuments(u, MARK()), "scenes", counts, conflicts, "world");
  for ( const scene of scenes ) {
    const tokens = [...scene.tokens];
    await batch(tokens, u => scene.updateEmbeddedDocuments("Token", u, MARK()), "tokens", counts, conflicts, scene.uuid);
    for ( const token of tokens ) await moveDelta(token, counts, conflicts);
    const regions = [...scene.regions];
    await batch(regions, u => scene.updateEmbeddedDocuments("Region", u, MARK()), "regions", counts, conflicts, scene.uuid);
    for ( const region of regions ) await step(`${region.uuid}'s behaviours`, () => moveBehaviors(region, counts, conflicts));
  }
}

/**
 * A region's behaviours. One of the old subtype is INVALID while the old package is disabled (its
 * subtype is unregistered), so the region's SOURCE is read, never `region.behaviors`. It is retyped in
 * place: Foundry 14 changes a document's type only with its system REPLACED (a ForcedReplacement);
 * failing that, it is recreated under the new type with the same system data (emanations.js's
 * `adoptRegion` shape: name, disabled, system) and the old one deleted.
 */
async function moveBehaviors(region, counts, conflicts) {
  const legacy = behaviorType(LEGACY_ID);
  const sources = [...(region._source?.behaviors ?? [])];
  await batch(sources.filter(b => b.type !== legacy), u => region.updateEmbeddedDocuments("RegionBehavior", u, MARK()),
    "behaviors", counts, conflicts, region.uuid);
  const convert = sources.map(b => behaviorMove(b, IDS)).filter(Boolean);
  if ( !convert.length ) return;
  const replace = foundry.data?.operators?.ForcedReplacement;
  try {
    await region.updateEmbeddedDocuments("RegionBehavior", convert.map(c => ({ ...c.update,
      system: replace ? replace.create(c.update.system) : c.update.system })), MARK());
  } catch(err) { console.warn(`${TITLE} | ${region.uuid}: the behaviours' type would not update in place, so they are recreated.`, err); }
  const now = () => region._source?.behaviors ?? [];
  const type = behaviorType(MODULE_ID);
  const left = convert.filter(c => now().find(b => b._id === c.id)?.type !== type);
  if ( left.length ) {
    // A load that recreated but could not delete finds its copy, stamped with the old behaviour's id.
    const standing = c => now().some(b => (b.type === type) && (b.flags?.[MODULE_ID]?.[MIGRATED_FROM] === c.id));
    const create = left.filter(c => !standing(c)).map(c => c.create);
    if ( create.length ) await region.createEmbeddedDocuments("RegionBehavior", create, MARK());
    await region.deleteEmbeddedDocuments("RegionBehavior", left.map(c => c.id), MARK());
  }
  counts.behaviors = (counts.behaviors ?? 0) + convert.length;
}

/** Every Combat and its Combatants. */
async function moveCombats(counts, conflicts) {
  const combats = [...game.combats];
  await batch(combats, u => Combat.updateDocuments(u, MARK()), "combats", counts, conflicts, "world");
  for ( const combat of combats ) {
    await batch([...combat.combatants], u => combat.updateEmbeddedDocuments("Combatant", u, MARK()),
      "combatants", counts, conflicts, combat.uuid);
  }
}
