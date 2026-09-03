/**
 * Battle Flow — Emanations: an aura applies itself to the creatures inside it, and the platform keeps the geometry and the clock.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, activeCombatFor, statContext, whisperNoGM } from "./core.js";
import { emanationEntries } from "./settings.js";
import { turnChitStands, writeTurnChit } from "./shared.js";
import { bfCard, ruleLine } from "./decide/present.js";
import { EMANATIONS } from "./decide/registry.js";
import { reachAdmits, resolveChanges, emanationRange, triggerDue, memberEffectData } from "./decide/emanations.js";
import { rollDamageForSave } from "./auto-damage.js";

/* ---------------------------------------------------------------------------------------------
 * EMANATIONS (user ruling 2026-09-03 — DESIGN §4 amended: "emanations are a core part of combat and
 * you want to automate the application of damage, effects, bonuses etc. — no different than auto
 * applying Slow with mastery"). Paladin's aura is the example; the class is "a persistent area
 * attached to a token whose effect applies to the creatures inside it".
 *
 * THE PLATFORM MODELS IT — MEASURED, NOT REASONED (tools/probe-emanations.mjs, Foundry 14.365):
 *   - `RegionDocument.createTokenEmanation(token, range)` makes a Region shaped as the token's base
 *     plus the radius (the 2024 rule — from the edge, not the centre), ATTACHED to the token; the
 *     region moves with the token and its membership is recomputed as it goes. The token's own
 *     emanation does not count the token.
 *   - a template's Region can be attached the same way (`attachment.token`) and the template moves too.
 *   - the Region raises tokenEnter / tokenExit (a creature moving, OR the area moving onto a
 *     standing creature) and tokenTurnStart / tokenTurnEnd (the Combat dispatches those to the one
 *     designated GM). A module registers its own behaviour type through
 *     `CONFIG.RegionBehavior.dataModels` — public API, the way dnd5e registers difficult terrain.
 *   - the 2024 pack ships every aura's EFFECT and says in its own text that who-is-inside is not
 *     automated. What it does not ship is the SOURCE's numbers: a formula on an effect resolves
 *     against the creature wearing it ("it will add their Charisma modifier and not the Paladin's",
 *     the pack's note on Aura of Protection). So the effect handed to a member is the pack's
 *     effect with the source's values read in (decide/emanations.js resolveChanges).
 *
 * WHAT THE MODULE OWNS, and only this:
 *   - the ROWS (decide/registry.js EMANATIONS; membership is the Emanations list) — which item,
 *     which effect, who it reaches, where its range lives, what triggers inside it;
 *   - the LIFECYCLE — a feature's emanation stands whenever its token is on the scene and the
 *     range resolves (reconcileScene); a spell's is the template the system placed, adopted when its
 *     Region appears and gone when the template goes (concentration's own cascade);
 *   - the FLOOR — the active GM keeps the standing effects true to membership (reconcileMembers) on
 *     every event and on every token move: apply to a member that lacks it, lift from a non-member
 *     that carries it. The Region's events are the fast path; the floor is the truth (the saves
 *     machine's render floor, the same lesson);
 *   - the TRIGGER — a spell row's save, raised as a demand CARD carrying a `saves` flag for the one
 *     creature: the saves machine drives it off the bus (R2 — no import between the two machines).
 *
 * WHO WRITES: the active GM, always — regions, behaviours and effects on other people's tokens are
 * GM writes. With no GM the flow-elect law applies: nothing lands, and the client that moved says so.
 *
 * REACH (user, 2026-09-03): helpful auras reach allies and neutrals, harmful ones enemies, by token
 * disposition — the caster's "designate creatures to be unaffected" is that default.
 * DRAWN as a ring for everyone (user: "let's try a faint ring, I need to judge") in the palette's hue.
 * ------------------------------------------------------------------------------------------- */

const FLAG = "emanation";                       // on the region, and on every member effect
const TYPE = `${MODULE_ID}.emanation`;          // the behaviour type this module registers
const lower = s => String(s ?? "").toLowerCase();
const listed = () => new Set(emanationEntries().map(e => lower(e.kind)));
const rowNamed = name => { const k = Object.keys(EMANATIONS).find(x => lower(x) === lower(name)); return k ? { key: k, ...EMANATIONS[k] } : null; };
const live = () => setting(S.emanations);
const colorFor = reach => (reach === "harmful") ? "#b4463c" : "#46965f";   // TONE.bad / TONE.good, solid — a Region colour is a hex

/** The one Battle Flow behaviour on a region, or null. */
const behaviorOf = region => region?.behaviors?.find(b => b.type === TYPE) ?? null;
/** The region's Battle Flow flag, or null. */
const flagOf = region => region?.getFlag?.(MODULE_ID, FLAG) ?? null;

/* --- the behaviour type: registered at init, events handled on the GM ---------------------- */

Hooks.once("init", () => {
  const Base = foundry.data?.regionBehaviors?.RegionBehaviorType;
  const F = foundry.data?.fields;
  if ( !Base || !F ) { console.warn(`${TITLE} | Region behaviours are not available on this Foundry — emanations off.`); return; }
  const EV = CONST.REGION_EVENTS;

  class EmanationBehaviorType extends Base {
    static defineSchema() {
      return {
        key: new F.StringField({ blank: false, label: "Emanation", hint: "The Battle Flow emanation row this area carries." }),
        source: new F.StringField({ nullable: true, initial: null, label: "Source token", hint: "The token the emanation originates from (uuid)." }),
        item: new F.StringField({ nullable: true, initial: null, label: "Source item", hint: "The feature or spell on the source's sheet (uuid)." }),
        reach: new F.StringField({ initial: "helpful", choices: { helpful: "Allies and neutrals", harmful: "Enemies" }, label: "Reach" }),
        scaling: new F.NumberField({ integer: true, min: 0, initial: 0, label: "Upcast levels" }),
        effect: new F.ObjectField({ nullable: true, initial: null, label: "Effect", hint: "The pack's effect with the source's numbers read in." })
      };
    }
    /** GM-side: the region's membership changed under this token. */
    static async #onEnter(event) { if ( !gmHandles(event) ) return; await reconcileMembers(this.region); await maybeTrigger(this, event.data?.token ?? null, "enter"); }
    static async #onExit(event) { if ( !gmHandles(event) ) return; await reconcileMembers(this.region); }
    static async #onTurnEnd(event) { if ( !gmHandles(event) ) return; await maybeTrigger(this, event.data?.token ?? event.data?.combatant?.token ?? null, "turnEnd"); }
    static async #onToggle(event) { if ( !gmHandles(event) ) return; await reconcileMembers(this.region); }
    static events = {
      [EV.TOKEN_ENTER]: this.#onEnter,
      [EV.TOKEN_EXIT]: this.#onExit,
      [EV.TOKEN_TURN_END]: this.#onTurnEnd,
      [EV.BEHAVIOR_ACTIVATED]: this.#onToggle,
      [EV.BEHAVIOR_DEACTIVATED]: this.#onToggle
    };
  }
  CONFIG.RegionBehavior.dataModels[TYPE] = EmanationBehaviorType;
  CONFIG.RegionBehavior.typeIcons[TYPE] = "fa-solid fa-circle-dot";
  if ( CONFIG.RegionBehavior.typeLabels ) CONFIG.RegionBehavior.typeLabels[TYPE] = "Battle Flow Emanation";
});

/** Region events reach every client; the active GM acts. With no GM, the mover's client says so once per event. */
function gmHandles(event) {
  if ( game.users.activeGM?.isSelf ) return true;
  if ( !game.users.activeGM && event?.user?.isSelf ) void whisperNoGM("an emanation's effect", "The aura stands on the map; apply its effect by hand.");
  return false;
}

/* --- the floor: standing effects true to membership -------------------------------------------- */

/** Every member effect of this region on this actor. */
const memberEffects = (actor, regionId) => actor?.effects?.filter(e => e.getFlag(MODULE_ID, FLAG)?.regionId === regionId) ?? [];

/**
 * Apply the standing effect to every member the reach admits, lift it from everyone else on the
 * scene. Idempotent, GM-only, cheap: membership is the platform's (`region.tokens`), the effect is
 * fingerprinted with the region's id.
 *
 * ⚠ SERIALIZED PER REGION. One token move fires the region's own enter event, the token's update
 * hook and the region's update hook within a tick, and three floors reading "no effect yet" before
 * any create lands wrote the same effect three times (smoke-emanations, first live run: Half Speed
 * stacked to ×0.0625). One reconcile at a time per region; a second request waits for the first.
 */
const reconciling = new Map();
function reconcileMembers(region) {
  if ( !region?.id ) return Promise.resolve();
  const prev = reconciling.get(region.id) ?? Promise.resolve();
  const run = prev.then(() => reconcileMembersNow(region));
  reconciling.set(region.id, run);
  return run.finally(() => { if ( reconciling.get(region.id) === run ) reconciling.delete(region.id); });
}
async function reconcileMembersNow(region) {
  try {
    if ( !isActiveGM() || !region?.parent ) return;
    if ( !region.parent.regions.has(region.id) ) return;   // gone while we waited
    const beh = behaviorOf(region);
    const sys = beh?.system;
    const row = sys ? rowNamed(sys.key) : null;
    const source = sys?.source ? fromUuidSync(sys.source) : null;
    const active = !!beh && !beh.disabled && !!row && !!sys.effect && live() && listed().has(lower(row.key));
    const members = new Set();
    if ( active ) {
      for ( const tok of region.tokens ?? [] ) {
        if ( !tok?.actor || (source && (tok.id === source.id)) ) continue;
        if ( !reachAdmits(sys.reach, source?.disposition ?? 1, tok.disposition) ) continue;
        members.add(tok);
      }
    }
    for ( const tok of members ) {
      const have = memberEffects(tok.actor, region.id);
      // One effect per region per creature: a duplicate that slipped in (a race before this
      // floor was serialized, a reload mid-write) is tidied rather than tolerated.
      if ( have.length > 1 ) await tok.actor.deleteEmbeddedDocuments("ActiveEffect", have.slice(1).map(e => e.id));
      if ( have.length ) continue;
      await tok.actor.createEmbeddedDocuments("ActiveEffect", [memberEffectData(row, sys.effect,
        { sourceName: source?.name ?? "the source", itemUuid: sys.item, regionId: region.id, moduleId: MODULE_ID, flagKey: FLAG })]);
    }
    for ( const tok of region.parent.tokens ) {
      if ( members.has(tok) || !tok.actor ) continue;
      const stale = memberEffects(tok.actor, region.id);
      if ( stale.length ) await tok.actor.deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id));
    }
  } catch(err) {
    console.error(`${TITLE} | Emanation floor failed — check the aura's effects by hand.`, err);
  }
}

/** The region is going: lift its effects from everyone on its scene. */
async function liftAll(region) {
  if ( !isActiveGM() || !region?.parent ) return;
  for ( const tok of region.parent.tokens ) {
    const stale = memberEffects(tok.actor, region.id);
    if ( stale.length ) await tok.actor.deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id)).catch(() => {});
  }
}

/* --- the trigger: a spell row's save, demanded of one creature over the bus ----------------- */

async function maybeTrigger(behType, token, cause) {
  try {
    if ( !isActiveGM() || !token?.actor ) return;
    const beh = behType.behavior;
    const sys = behType;   // the type instance IS the system data
    const row = rowNamed(sys.key);
    if ( !row?.trigger || !row.trigger.on.includes(cause) || beh.disabled || !live() || !listed().has(lower(row.key)) ) return;
    const region = behType.region;
    const source = sys.source ? fromUuidSync(sys.source) : null;
    if ( source && (token.id === source.id) ) return;
    if ( !reachAdmits(sys.reach, source?.disposition ?? 1, token.disposition) ) return;
    if ( !(region.tokens?.has?.(token) ?? true) && (cause === "turnEnd") ) return;   // ended its turn OUTSIDE
    const item = sys.item ? fromUuidSync(sys.item) : null;
    const activity = [...(item?.system?.activities ?? [])].find(a => a.type === "save") ?? null;
    const dc = activity?.save?.dc?.value;
    const abilities = [...(activity?.save?.ability ?? [])];
    if ( !activity || !(dc > 0) || !abilities.length ) return;
    const actor = token.actor;
    const combat = activeCombatFor(actor);
    const chitKey = `emanation:${region.id}`;
    const due = triggerDue({ inCombat: !!combat, chitStands: turnChitStands(actor, "rider", chitKey) });
    if ( !due.due ) return;
    if ( row.trigger.oncePerTurn && combat ) {
      await writeTurnChit(actor, "rider", { name: `${row.key} — saved this turn`, img: item.img ?? null,
        description: `${actor.name} has made ${row.key}'s save this turn; once per turn. This chit ends with the turn.`,
        origin: item.uuid, riderKey: chitKey }).catch(() => {});
    }
    const casterActor = item.actor ?? null;
    const onSave = activity.damage?.onSave ?? "half";
    const hasDamage = !!activity.damage?.parts?.length && (onSave !== "full");
    const window = Math.max(0, Number(setting(S.saveTimer)) || 0);
    const why = (cause === "enter") ? `entered ${source?.name ?? "the caster"}'s ${row.key}` : `ended its turn inside ${source?.name ?? "the caster"}'s ${row.key}`;
    const abilityLabel = CONFIG.DND5E.abilities[abilities[0]]?.label ?? abilities[0];
    const card = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: casterActor, token: source ?? undefined }),
      content: bfCard({
        img: item.img, eyebrow: "Emanation", tone: "bad",
        title: `${row.key} — ${actor.name} ${why}`,
        subtitle: `${abilityLabel} save DC ${dc} · ${due.why}${hasDamage ? ` · ${onSave === "half" ? "half on a success" : "none on a success"}` : ""}`,
        lines: [ruleLine(row.rule)]
      }),
      flags: { [MODULE_ID]: {
        saves: {
          status: "pending", ...statContext(casterActor?.uuid ?? null),
          abilities, dc, damageOnSave: onSave, hasDamage,
          effectNames: { fail: [], always: [] }, effectsHandled: "emanation",
          // The target is THIS creature and nothing re-derives it: the saves machine's area
          // adoption keys on the activity, which this card shares with the cast (first live run
          // rewrote the demand to whoever stood in the template). Pinned, and invisible to the
          // same-activity scans that disarm older casts.
          pinnedTargets: true,
          activityUuid: activity.uuid, templateType: null, templated: false,
          durationUnits: item.system?.duration?.units ?? null,
          item: { name: item.name, img: item.img ?? null }, casterName: casterActor?.name ?? null,
          scaling: Number(sys.scaling ?? 0),
          ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}),
          targets: [{ uuid: actor.uuid, name: token.name, done: false, outcome: null, total: null, rollMessageId: null }]
        },
        emanationTrigger: { key: row.key, cause, regionId: region.id, targetUuid: actor.uuid }
      } }
    });
    if ( hasDamage && card ) await rollDamageForSave(activity, card);
  } catch(err) {
    console.error(`${TITLE} | Emanation trigger failed — ask for the save by hand.`, err);
  }
}

/* --- the lifecycle: a feature's emanation stands with its token ------------------------------- */

/** The activity's own size, resolved on the source (it may be a formula — `@scale.paladin.aura`). */
function activitySizeOf(item, rollData) {
  const act = item?.system?.activities?.contents?.[0];
  const raw = act?._source?.target?.template?.size ?? act?.target?.template?.size ?? null;
  if ( (raw === null) || (raw === "") ) return null;
  const n = Number(raw);
  if ( Number.isFinite(n) ) return n;
  try { const r = Roll.replaceFormulaData(String(raw), rollData); return Roll.validate(r) ? Roll.safeEval(r) : null; } catch { return null; }
}

/** What a feature's emanation on this token should look like now, or null when it should not stand. */
function featureSpec(tok, row) {
  const actor = tok.actor;
  const item = actor?.items.find(i => lower(i.name) === lower(row.key)) ?? null;
  if ( !item ) return null;
  const rollData = actor.getRollData();
  const range = emanationRange(row, rollData, activitySizeOf(item, rollData));
  if ( !range ) return null;
  const effect = item.effects.find(e => lower(e.name) === lower(row.effect)) ?? null;
  if ( !effect ) return null;
  const { changes, unresolved } = resolveChanges(effect.changes.map(c => ({ key: c.key, mode: c.mode, value: c.value, priority: c.priority })), rollData);
  if ( unresolved.length ) { console.warn(`${TITLE} | ${row.key} on ${actor.name}: could not resolve ${unresolved.join(", ")} — the aura does not stand.`); return null; }
  return { tok, actor, item, row, range,
    effect: { name: effect.name, img: effect.img ?? item.img ?? null, description: row.rule, changes },
    disabled: !!row.incapacitated && actor.statuses?.has?.("incapacitated") };
}

/**
 * Debounced AND serialized per scene: many hooks fire for one change, and a sweep takes seconds
 * (one region create per aura). Two sweeps overlapping both read "Courage wanted, none standing"
 * and raised two Courage regions (smoke-emanations, third live run) — so a request that arrives
 * while a sweep runs waits for it, and re-sweeps once, however many asked.
 */
const sweepTimers = new Map();
const sweepChains = new Map();
function scheduleScene(scene) {
  if ( !scene?.id || !isActiveGM() || sweepTimers.has(scene.id) ) return;
  sweepTimers.set(scene.id, setTimeout(() => {
    sweepTimers.delete(scene.id);
    const prev = sweepChains.get(scene.id) ?? Promise.resolve();
    const run = prev.then(() => reconcileScene(scene)).catch(err => console.error(`${TITLE} | Emanation sweep failed.`, err));
    sweepChains.set(scene.id, run);
    void run.finally(() => { if ( sweepChains.get(scene.id) === run ) sweepChains.delete(scene.id); });
  }, 200));
}

/** Every scene that has a token of this actor on it. */
const scenesWith = actor => (actor instanceof Actor) ? game.scenes.filter(s => s.tokens.some(t => (t.actorId === actor.id) || (t.actor === actor))) : [];

/**
 * The feature emanations this scene should carry, made true: one region per (token, row) that
 * stands, updated when the range or the effect moved, deleted when the token or the feature is
 * gone. Spell emanations are not touched here — the template owns their life.
 */
async function reconcileScene(scene) {
  if ( !isActiveGM() || !scene ) return;
  const names = listed();
  const wanted = new Map();
  if ( live() ) {
    for ( const tok of scene.tokens ) {
      if ( !tok.actor ) continue;
      for ( const [key, row] of Object.entries(EMANATIONS) ) {
        if ( (row.kind !== "feature") || !names.has(lower(key)) ) continue;
        const spec = featureSpec(tok, { key, ...row });
        if ( spec ) wanted.set(`${tok.id}|${key}`, spec);
      }
    }
  }
  const px = scene.dimensions?.distancePixels ?? (scene.grid.size / scene.grid.distance);
  const seen = new Set();
  for ( const region of scene.regions.filter(r => flagOf(r)?.kind === "feature") ) {
    const f = flagOf(region);
    const id = `${f.tokenId}|${f.key}`;
    const w = wanted.get(id);
    // Not wanted, or a second region for the same aura (a race before the sweep was serialized):
    // lifted and deleted. One aura, one region.
    if ( !w || seen.has(id) ) { await liftAll(region); await region.delete().catch(() => {}); continue; }
    seen.add(id);
    wanted.delete(id);
    const beh = behaviorOf(region);
    const shape = region.shapes[0];
    const radius = w.range * px;
    if ( shape && (shape.radius !== radius) ) await region.update({ shapes: [{ ...shape.toObject(), radius }] });
    if ( beh ) {
      const upd = {};
      if ( beh.disabled !== w.disabled ) upd.disabled = w.disabled;
      if ( !foundry.utils.objectsEqual(beh.system.effect?.changes ?? null, w.effect.changes) ) upd["system.effect"] = w.effect;
      if ( !foundry.utils.isEmpty(upd) ) await beh.update(upd);
    }
    await reconcileMembers(region);
  }
  for ( const w of wanted.values() ) {
    const region = await CONFIG.Region.documentClass.createTokenEmanation(w.tok, w.range, {
      name: `${w.row.key} — ${w.actor.name}`, color: colorFor(w.row.reach), visibility: CONST.REGION_VISIBILITY.ALWAYS,
      behaviors: [{ type: TYPE, name: w.row.key, disabled: w.disabled,
        system: { key: w.row.key, source: w.tok.uuid, item: w.item.uuid, reach: w.row.reach, scaling: 0, effect: w.effect } }],
      flags: { [MODULE_ID]: { [FLAG]: { kind: "feature", key: w.row.key, tokenId: w.tok.id, itemUuid: w.item.uuid } } }
    }).catch(err => { console.error(`${TITLE} | Could not raise ${w.row.key} around ${w.actor.name}.`, err); return null; });
    if ( !region ) continue;
    await announce(w.row, w.actor, w.item, w.range, w.effect, "stands");
    await reconcileMembers(scene.regions.get(region.id) ?? region);
  }
}

/* --- the lifecycle: a spell's emanation is the template the system placed ------------------- */

async function adoptSpellRegion(region) {
  try {
    if ( !isActiveGM() || !live() || flagOf(region) ) return;
    const itemUuid = region.getFlag("dnd5e", "item");
    const item = itemUuid ? fromUuidSync(itemUuid) : null;
    if ( !item ) return;
    const row = rowNamed(item.name);
    if ( !row || (row.kind !== "spell") || !listed().has(lower(row.key)) ) return;
    const actor = item.actor ?? null;
    const tok = actor?.token ?? region.parent.tokens.find(t => t.actor && ((t.actor === actor) || (t.actor.uuid === actor?.uuid))) ?? null;
    const rollData = actor?.getRollData?.() ?? {};
    const effect = row.effect ? (item.effects.find(e => lower(e.name) === lower(row.effect)) ?? null) : null;
    const resolved = effect ? resolveChanges(effect.changes.map(c => ({ key: c.key, mode: c.mode, value: c.value, priority: c.priority })), rollData) : { changes: [], unresolved: [] };
    const spellLevel = Number(region.getFlag("dnd5e", "spellLevel") ?? item.system?.level ?? 0);
    const scaling = Math.max(0, spellLevel - Number(item.system?.level ?? 0));
    // The behaviour FIRST, the flag second: the flag is what every reader keys on, so a region
    // that carries it always carries its behaviour too (a suite read the flag before the
    // behaviour landed and saw an emanation with nothing on it).
    await region.createEmbeddedDocuments("RegionBehavior", [{ type: TYPE, name: row.key,
      system: { key: row.key, source: tok?.uuid ?? null, item: itemUuid, reach: row.reach, scaling,
        effect: (effect && !resolved.unresolved.length) ? { name: effect.name, img: effect.img ?? item.img ?? null, description: row.rule, changes: resolved.changes } : null } }]);
    await region.update({
      ...(tok ? { attachment: { token: tok.id } } : {}),
      color: colorFor(row.reach), visibility: CONST.REGION_VISIBILITY.ALWAYS,
      flags: { [MODULE_ID]: { [FLAG]: { kind: "spell", key: row.key, tokenId: tok?.id ?? null, itemUuid } } }
    });
    const size = activitySizeOf(item, rollData);
    await announce(row, actor, item, size ?? region.shapes[0]?.radiusX ?? null, effect ? { name: effect.name, changes: resolved.changes } : null, "is cast");
    await reconcileMembers(region);
  } catch(err) {
    console.error(`${TITLE} | Could not adopt a spell's emanation — its effects apply by hand.`, err);
  }
}

/* --- the card (R5 / N3): an emanation says what it is when it appears ------------------------- */

const KEY_LABELS = {
  "system.bonuses.abilities.save": v => `${Number(v) >= 0 ? "+" : ""}${v} to saving throws`,
  "system.traits.dr.value": v => `Resistance to ${v}`,
  "system.traits.di.value": v => `Immunity to ${v}`,
  "system.traits.ci.value": v => `Immunity to the ${String(v).replace(/^\w/, c => c.toUpperCase())} condition`,
  "system.attributes.movement.speed": v => `Speed ×${v}`
};
function describeChanges(changes) {
  const parts = (changes ?? []).map(c => (KEY_LABELS[c.key] ?? (v => `${c.key} ${v}`))(c.value));
  return parts.length ? parts.join(", ") : "the effect as the pack ships it";
}

async function announce(row, actor, item, range, effect, verb) {
  try {
    const reach = row.reach === "helpful" ? "allies and neutrals inside" : "enemies inside";
    const rangeText = range ? `${range}-foot Emanation` : "Emanation";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: bfCard({
        img: item?.img ?? null, eyebrow: "Emanation", tone: row.reach === "helpful" ? "good" : "bad",
        title: `${row.key} — ${actor?.name ?? ""} — ${rangeText}`,
        subtitle: effect ? `${reach}: ${effect.name} — ${describeChanges(effect.changes)}${row.trigger ? " · a save on entering and on ending a turn inside" : ""}` : (row.trigger ? "a save on entering and on ending a turn inside" : reach),
        lines: [ruleLine(row.rule), row.caveat ? `<span style="opacity:0.8;">${row.caveat}</span>` : null]
      }),
      flags: { [MODULE_ID]: { emanationCard: { ...statContext(actor?.uuid ?? null), key: row.key, verb, range: range ?? null } } }
    });
  } catch(err) {
    console.warn(`${TITLE} | Could not post the emanation card.`, err);
  }
}

/* --- the hooks: when to look ---------------------------------------------------------------- */

Hooks.once("ready", () => { if ( game.scenes.active ) scheduleScene(game.scenes.active); });
// The switch or the list moved (settings.js says so on change): every scene that carries an
// emanation, and the active one, is swept — off removes what stands, on raises it again.
Hooks.on(`${MODULE_ID}.emanationsChanged`, () => {
  for ( const s of game.scenes ) if ( (s === game.scenes.active) || (s === game.scenes.viewed) || s.regions.some(r => flagOf(r)) ) scheduleScene(s);
});
Hooks.on("canvasReady", canvasObj => scheduleScene(canvasObj?.scene ?? game.scenes.viewed));
Hooks.on("createToken", tok => scheduleScene(tok.parent));
Hooks.on("deleteToken", tok => scheduleScene(tok.parent));
Hooks.on("updateToken", (tok, changes) => {
  if ( !isActiveGM() || !tok.parent ) return;
  // A move: the floor over every emanation on this scene (membership is the platform's, already
  // recomputed). A change of actor or disposition: the whole sweep.
  if ( ("x" in changes) || ("y" in changes) || ("elevation" in changes) || ("_regions" in changes) ) {
    for ( const region of tok.parent.regions.filter(r => flagOf(r)) ) void reconcileMembers(region);
  }
  if ( ("actorId" in changes) || ("disposition" in changes) || ("actorLink" in changes) ) scheduleScene(tok.parent);
});
Hooks.on("updateRegion", (region, changes) => {
  if ( !isActiveGM() || !flagOf(region) ) return;
  if ( ("shapes" in changes) || ("attachment" in changes) || ("behaviors" in changes) ) void reconcileMembers(region);
});
Hooks.on("createRegion", region => { if ( isActiveGM() ) void adoptSpellRegion(region); });
Hooks.on("deleteRegion", region => {
  const f = flagOf(region);
  if ( !isActiveGM() || !f ) return;
  void liftAll(region);
  // A feature's aura deleted by hand stands again on the next sweep: it is always on, and the
  // switch for it is the setting or the list, not the region (a spell's dies with its template).
  if ( f.kind === "feature" ) scheduleScene(region.parent);
});
// A feature gained or lost, a level taken, a Charisma changed: the sources' scenes are swept.
for ( const hook of ["createItem", "deleteItem", "updateItem"] ) {
  Hooks.on(hook, item => { if ( item?.parent instanceof Actor ) for ( const s of scenesWith(item.parent) ) scheduleScene(s); });
}
Hooks.on("updateActor", (actor, changes) => {
  if ( ("system" in changes) || ("items" in changes) ) for ( const s of scenesWith(actor) ) scheduleScene(s);
});
// Incapacitated on or off a source: the behaviour toggles, the floor lifts or re-applies.
for ( const hook of ["createActiveEffect", "deleteActiveEffect", "updateActiveEffect"] ) {
  Hooks.on(hook, effect => {
    const actor = (effect?.parent instanceof Actor) ? effect.parent : effect?.parent?.parent;
    if ( !(actor instanceof Actor) || effect.getFlag?.(MODULE_ID, FLAG) ) return;   // never re-sweep on our own member effects
    for ( const s of scenesWith(actor) ) scheduleScene(s);
  });
}
