/**
 * Battle Flow — Token lights: a use whose text sheds light carries it as the token's own light, on an effect.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, canApplyTo, drivesMomentFor, queueFlagWrite, statContext } from "./core.js";
import { lower, resolveUuid } from "./lookup.js";
import { tokenLightEntries, tokenSenseEntries, listedNames } from "./settings.js";
import { registerResumable } from "./ui.js";
import { bfCard, ruleLine } from "./decide/present.js";
import { TOKEN_LIGHTS, TOKEN_SENSES } from "./decide/registry.js";
import { lightRowKey, lightChanges, lightTargets, senseRowKey, senseChanges, carriesSense } from "./decide/token-lights.js";
import { targetsOf } from "./decide/card.js";
import { effectRecord, joinEffectReceipt } from "./decide/receipt.js";
import { SURFACES } from "./surfaces.js";

/* ---------------------------------------------------------------------------------------------
 * TOKEN LIGHTS (user, 2026-09-25, the Aasimar walk: "inner radiance - add the bright/dim light
 * settings. this is a net new add. while you are at it, since it will have the same shape, edit
 * the Light spell so it adds light emission to a token target as well"). The table is
 * decide/registry.js TOKEN_LIGHTS; membership is the Token Lights list.
 *
 * THE PLATFORM CARRIES THE LIGHT (measured on Foundry 14.368): an effect change keyed `token.*`
 * is applied to the bearer's TOKENS (Actor#applyActiveEffects keeps them apart,
 * TokenDocument#applyActiveEffects applies them — `light` is one of its targetable keys). So the
 * light is two changes on an effect, and the effect's own life is the light's: its clock, its
 * removal from the sheet, the rest that clears it. No token document is written, and nothing here
 * has to remember a token's old light to put it back.
 *
 *   self     Inner Radiance: the pack ships its Searing Radiance effect on a DAMAGE activity,
 *            which nothing lands on its user (the cast slice keeps its hands off bare damage), so
 *            this machine lands it — the pack's effect, its own clock, the light added. The ring
 *            and the pulse stand while it does (emanations.js, the row's `while`); the Revelation
 *            rider reads it as the form (clock-riders.js).
 *   targets  the Light spell: every creature targeted at the cast wears a "Light" effect of the
 *            module's making — the spell's hour, the light added; casting it again puts the
 *            caster's earlier light out ("The spell ends if you cast it again"). Nobody targeted:
 *            the pack's own use stands (its summoned light, which the use then still places).
 *
 * WHERE IT RUNS: the casting client stamps the payload on the use's own card (its author may
 * write it); the flow elect applies it — the active GM, who may write every sheet, or with no GM
 * the caster's own client, which lands what it owns and says what it could not. The card says
 * what shed light (R5).
 * ------------------------------------------------------------------------------------------- */

const LIGHT_FLAG = "tokenLight";
const listed = () => listedNames(tokenLightEntries());

/** The row this use answers to, as `{ key, ...row }`, or null. */
function rowFor(activity) {
  const key = lightRowKey(TOKEN_LIGHTS, { itemName: activity?.item?.name, activityName: activity?.name }, listed());
  return key ? { key, ...TOKEN_LIGHTS[key] } : null;
}

// A `targets` row cast AT someone lights them, not a summoned object: the system's summon prompt is
// switched off for that use only. Nobody targeted, the pack's use runs as it ships.
Hooks.on("dnd5e.preUseActivity", (activity, usageConfig) => {
  try {
    const row = rowFor(activity);
    if ( (row?.on !== "targets") || !game.user.targets.size ) return;
    usageConfig.create ??= {};
    usageConfig.create.summons = false;
  } catch(err) { console.warn(`${TITLE} | Could not switch off the summon for a token light.`, err); }
});

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  try {
    const row = rowFor(activity);
    const actor = activity?.actor;
    if ( !row || !actor?.isOwner ) return;
    const message = (results?.message instanceof ChatMessage) ? results.message : null;
    const tok = actor.token ?? activity.getUsageToken?.() ?? actor.getActiveTokens?.(true, true)?.[0] ?? null;
    const snapshot = message ? targetsOf(message) : [];
    const live = [...game.user.targets].filter(t => t.actor).map(t => ({ uuid: t.actor.uuid, name: t.name }));
    const targets = lightTargets(row, { self: { uuid: actor.uuid, name: tok?.name ?? actor.name },
      targets: (snapshot.length ? snapshot : live).map(t => ({ uuid: t.uuid, name: t.name })) });
    if ( !targets.length ) return;
    const payload = { ...statContext(actor.uuid), key: row.key, itemUuid: activity.item.uuid, activityUuid: activity.uuid,
      targets, done: false };
    if ( message ) void message.setFlag(MODULE_ID, LIGHT_FLAG, payload).catch(err => console.error(`${TITLE} | Could not stamp the token light.`, err));
    else void applyLight(payload);   // no card to carry it: this client lands what it may
  } catch(err) {
    console.error(`${TITLE} | Token light failed — set the token's light by hand.`, err);
  }
});

/** Every effect this row's light stands on for this caster, across the world's actors and every scene's unlinked ones. */
function standingLights(key, sourceUuid) {
  const out = [];
  const actors = new Set(game.actors);
  for ( const scene of game.scenes ) for ( const t of scene.tokens ) if ( t.actor && !t.actorLink ) actors.add(t.actor);
  for ( const actor of actors ) {
    for ( const e of actor.effects ) {
      const f = e.getFlag(MODULE_ID, LIGHT_FLAG);
      if ( f && (f.key === key) && (f.sourceUuid === sourceUuid) ) out.push(e);
    }
  }
  return out;
}

/** The effect data this row lands on one creature: the pack's own effect or the module's, the light added. */
function lightEffectData(row, item, activity, target, sourceUuid) {
  const base = row.effect ? item?.effects?.find(e => lower(e.name) === lower(row.effect)) ?? null : null;
  if ( row.effect && !base ) return null;
  const data = base ? base.toObject() : {
    name: item?.name ?? row.key, img: item?.img ?? "icons/magic/light/explosion-star-glow-silhouette.webp",
    type: "base", description: `<p><em>“${row.rule}”</em></p>`,
    duration: activity?.duration?.getEffectData?.() ?? {}
  };
  delete data._id;
  // The pack's own clock for its effect (Searing Radiance's minute) — or, clockless, the activity's.
  if ( base ) foundry.utils.mergeObject(data, activity?.getAppliedEffectChanges?.(base, { target }) ?? {});
  data.system ??= {};
  data.system.changes = [...(data.system.changes ?? []), ...lightChanges(row)];
  data.disabled = false;
  data.transfer = false;
  data.origin = item?.uuid ?? null;
  foundry.utils.mergeObject(data, { flags: { [MODULE_ID]: { [LIGHT_FLAG]: { key: row.key, sourceUuid } } } });
  return data;
}

/**
 * Land a payload's light: the caster's earlier light put out when the row says a recast ends it,
 * a stale copy of this row's light on a target replaced, then the effect created on every target
 * this client may write. Returns what landed and what could not.
 */
async function applyLight(payload) {
  const row = TOKEN_LIGHTS[payload.key] ? { key: payload.key, ...TOKEN_LIGHTS[payload.key] } : null;
  if ( !row ) return { landed: [], skipped: [] };
  // live only: the item the use named — a cantrip and a species feature are never used up
  const item = resolveUuid(payload.itemUuid);
  // live only: its activity, for the same reason — the clock the effect takes is the live one's
  const activity = resolveUuid(payload.activityUuid);
  const landed = [];
  const skipped = [];
  if ( row.recast === "ends" ) {
    for ( const e of standingLights(row.key, payload.sourceUuid) ) {
      if ( canApplyTo(e.parent) ) await e.delete().catch(() => {});
    }
  }
  for ( const t of payload.targets ?? [] ) {
    const actor = await fromUuid(t.uuid);
    if ( !(actor instanceof Actor) ) continue;
    if ( !canApplyTo(actor) ) { skipped.push(t.name); continue; }
    const stale = actor.effects.filter(e => e.getFlag(MODULE_ID, LIGHT_FLAG)?.key === row.key);
    if ( stale.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id)).catch(() => {});
    const data = lightEffectData(row, item, activity, actor, payload.sourceUuid);
    if ( !data ) { skipped.push(t.name); continue; }
    const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
    if ( effect ) landed.push({ uuid: actor.uuid, name: t.name, img: actor.img ?? null, effectId: effect.id, effectName: effect.name, effectImg: effect.img ?? null });
  }
  return { landed, skipped };
}

async function driveLight(message) {
  let claimed = false;
  await queueFlagWrite(message, LIGHT_FLAG, current => {
    if ( current.done ) return false;
    current.done = true;
    claimed = true;
  });
  if ( !claimed ) return;
  const payload = message.getFlag(MODULE_ID, LIGHT_FLAG);
  const { landed, skipped } = await applyLight(payload);
  await queueFlagWrite(message, LIGHT_FLAG, current => { current.landed = landed; current.skipped = skipped; });
  // The receipt every effect application writes (the effect riders' idiom): the row names the
  // effect that carries the light, and its revert takes the light off with it.
  const row = TOKEN_LIGHTS[payload.key];
  if ( landed.length ) await queueFlagWrite(message, "effectReceipt", current => {
    for ( const l of landed ) joinEffectReceipt(current, { uuid: l.uuid, name: l.name, img: l.img,
      effects: [effectRecord({ id: l.effectId, name: l.effectName, img: l.effectImg, description: row?.rule ?? "" }, statContext(payload.sourceUuid ?? null))] });
  });
}

// On the flow elect, on arrival, on the stamp's update and on reload — once, behind the claim.
registerResumable(LIGHT_FLAG, {
  pending: flag => !!flag?.targets?.length && !flag.done,
  drives: flag => drivesMomentFor(flag.sourceUuid ?? null),
  drive: driveLight
});

/* --- the card says it (R5) -------------------------------------------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const f = message.getFlag(MODULE_ID, LIGHT_FLAG);
  if ( !f?.done || !(f.landed || f.skipped) ) return;
  const row = TOKEN_LIGHTS[f.key];
  if ( !row ) return;
  const names = (f.landed ?? []).map(l => l.name);
  const line = document.createElement("div");
  line.innerHTML = bfCard({
    eyebrow: "Token light", tone: names.length ? "good" : "neutral",
    title: names.length ? `${f.key} — ${names.join(", ")} shed${names.length === 1 ? "s" : ""} light: ${row.bright} ft Bright, ${row.dim - row.bright} ft more Dim`
      : `${f.key} — no light landed`,
    subtitle: [
      row.on === "self" ? "while the transformation stands" : "for the spell's duration; casting it again puts it out",
      (f.skipped ?? []).length ? `not landed (no permission here): ${f.skipped.join(", ")}` : null,
      row.caveat ?? null
    ].filter(Boolean).join(" · "),
    lines: [ruleLine(row.rule)]
  });
  html.querySelector(SURFACES.messageContent)?.appendChild(line);
});

/* ---------------------------------------------------------------------------------------------
 * TOKEN SENSES (user, 2026-09-25, the Dwarf walk: "figure out a way to change the vision type to
 * tremor sense for the duration"). The table is decide/registry.js TOKEN_SENSES; membership is
 * the Token Senses list. The carrier is the light's — `token.*` changes on an effect — but the
 * effect is the PACK's own (Stonecunning's, landed by the cast slice's self-aim or a tray click),
 * so nothing is landed here: the changes are added to it AS IT IS CREATED on a sheet, on the
 * creating client, whoever creates it. The sense then lives and dies with the pack's effect — its
 * ten-minute clock, its removal — and no token document is written.
 * ------------------------------------------------------------------------------------------- */

Hooks.on("preCreateActiveEffect", (effect, data) => {
  try {
    if ( !(effect.parent instanceof Actor) ) return;   // the item's own copy stays as the pack ships it
    const key = senseRowKey(TOKEN_SENSES, effect.name, listedNames(tokenSenseEntries()));
    if ( !key ) return;
    const changes = [...(effect._source.system?.changes ?? data?.system?.changes ?? [])];
    if ( carriesSense(changes) ) return;
    effect.updateSource({ "system.changes": [...changes, ...senseChanges(TOKEN_SENSES[key])] });
  } catch(err) { console.warn(`${TITLE} | Could not add the token sense — set the token's vision by hand.`, err); }
});
