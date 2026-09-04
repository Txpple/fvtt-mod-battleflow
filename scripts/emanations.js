/**
 * Battle Flow — Emanations: an aura applies itself to the creatures inside it, and the platform keeps the geometry and the clock.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, activeCombatFor, statContext, whisperNoGM, drivesMomentFor } from "./core.js";
import { emanationEntries } from "./settings.js";
import { turnChitStands, writeTurnChit } from "./shared.js";
import { tokensInTemplates } from "./geometry.js";
import { bfCard, ruleLine } from "./decide/present.js";
import { EMANATIONS } from "./decide/registry.js";
import { reachAdmits, resolveChanges, emanationRange, triggerDue, memberEffectData, damageTypeFor, appliesOnScene } from "./decide/emanations.js";
import { registerRelay } from "./ui.js";
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
const STATUS = "bfEmanation";                   // the status a member effect wears, so the token shows it
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
    static async #onExit(event) { if ( !gmHandles(event) ) return; await forgetInitial(this.region, event.data?.token ?? null); await reconcileMembers(this.region); }
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

/** Only the ACTIVE scene's emanations apply (decide/emanations.js appliesOnScene — the bleed). */
const appliesHere = region => appliesOnScene(region?.parent?.id ?? null, game.scenes.active?.id ?? null).applies;

/**
 * Everyone who could be wearing this region's effect: the actors of the tokens on its scene AND
 * every world actor. A member effect lives on the ACTOR, so a linked actor carries it to every
 * scene it has a token on — and if its token on this scene is deleted, only the world list still
 * reaches it. The lift reads both so nothing is orphaned.
 */
function holdersOf(region) {
  const out = new Set();
  for ( const tok of region?.parent?.tokens ?? [] ) if ( tok.actor ) out.add(tok.actor);
  for ( const actor of game.actors ) out.add(actor);
  return out;
}

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
    const active = !!beh && !beh.disabled && !!row && !!sys.effect && live() && listed().has(lower(row.key)) && appliesHere(region);
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
        { sourceName: source?.name ?? "the source", itemUuid: sys.item, regionId: region.id, moduleId: MODULE_ID, flagKey: FLAG, status: STATUS })]);
    }
    const keep = new Set([...members].map(tok => tok.actor));
    for ( const actor of holdersOf(region) ) {
      if ( keep.has(actor) ) continue;
      const stale = memberEffects(actor, region.id);
      if ( stale.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id));
    }
  } catch(err) {
    console.error(`${TITLE} | Emanation floor failed — check the aura's effects by hand.`, err);
  }
}

/** The region is going: lift its effects from everyone who holds one (its scene's tokens and the world's actors). */
async function liftAll(region) {
  if ( !isActiveGM() || !region?.parent ) return;
  for ( const actor of holdersOf(region) ) {
    const stale = memberEffects(actor, region.id);
    if ( stale.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id)).catch(() => {});
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
    if ( !appliesHere(region) ) return;   // a ring on a scene nobody is playing on demands nothing
    const source = sys.source ? fromUuidSync(sys.source) : null;
    if ( source && (token.id === source.id) ) return;
    if ( !reachAdmits(sys.reach, source?.disposition ?? 1, token.disposition) ) return;
    // A creature standing inside when the area was cast was asked by the CAST's own demand
    // (user walk, 2026-09-03: "if I cast it and the dummy is in range, it triggers two saves").
    // Its first "enter" — the area attaching around it — is not an entry; the record is
    // forgotten once used, and on a real exit, so a later re-entry asks as it should.
    if ( cause === "enter" ) {
      const f = flagOf(region);
      if ( f?.initial?.includes(token.id) ) { await forgetInitial(region, token); return; }
    }
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
        emanationTrigger: { key: row.key, cause, regionId: region.id, targetUuid: actor.uuid, inCombat: !!combat, why: due.why }
      } }
    });
    if ( hasDamage && card ) await rollDamageForSave(activity, card);
  } catch(err) {
    console.error(`${TITLE} | Emanation trigger failed — ask for the save by hand.`, err);
  }
}

/** Drop a token from the region's "asked at the cast" record. */
async function forgetInitial(region, token) {
  const f = flagOf(region);
  if ( !token || !f?.initial?.includes(token.id) ) return;
  await region.setFlag(MODULE_ID, FLAG, { ...f, initial: f.initial.filter(id => id !== token.id) }).catch(() => {});
}

/**
 * Make a template's Region this module's emanation: the behaviour first (the flag every reader
 * keys on is written last, so a flagged region always carries its behaviour), attached to the
 * source token, INVISIBLE as a region — the template it backs draws the ring (user, 2026-09-03:
 * "the black circle, not the green area") — and flagged with what it is, plus who stood inside
 * when it appeared (the cast's demand already asked those).
 */
async function adoptRegion(region, { kind, key, tok, itemUuid, reach, scaling = 0, effect = null, disabled = false }) {
  // ⚠ ORDER. The "asked at the cast" record goes down FIRST: creating the behaviour subscribes
  // it to events, and attaching the region recomputes membership and raises tokenEnter for
  // everyone inside — a trigger that read the record before it was written asked the dummy a
  // second time (smoke-emanations, fifth live run). The flag is also what every reader keys
  // on, and a flagged region without its behaviour is tolerated for the milliseconds between.
  // ⚠ GEOMETRY, not membership: a region just created has not computed `tokens` yet (empty for
  // the first beat — the record came out empty and the dummy was asked twice again). The
  // template it backs is on the scene now, and the spine's containment reads it directly.
  const template = region.parent?.templates?.get(region.id) ?? null;
  const inside = template ? (tokensInTemplates([template]) ?? []).map(e => e.tokenId) : [...(region.tokens ?? [])].map(t => t.id);
  const initial = inside.filter(id => id && (id !== tok?.id));
  await region.update({
    color: colorFor(reach), visibility: CONST.REGION_VISIBILITY.LAYER,
    flags: { [MODULE_ID]: { [FLAG]: { kind, key, tokenId: tok?.id ?? null, itemUuid, initial } } }
  });
  await region.createEmbeddedDocuments("RegionBehavior", [{ type: TYPE, name: key, disabled,
    system: { key, source: tok?.uuid ?? null, item: itemUuid, reach, scaling, effect } }]);
  if ( tok ) await region.update({ attachment: { token: tok.id } });
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
  // ONLY THE ACTIVE SCENE raises a ring. A party leaves a token of itself on every scene it
  // has visited (Thomas stood on 22 of them, 2026-09-04), and a ring on each put the aura's
  // effect on the ally beside him seventeen times over. On any other scene the areas come down
  // and their effects are lifted.
  if ( live() && (scene.id === game.scenes.active?.id) ) {
    for ( const tok of scene.tokens ) {
      if ( !tok.actor ) continue;
      for ( const [key, row] of Object.entries(EMANATIONS) ) {
        if ( (row.kind !== "feature") || !names.has(lower(key)) ) continue;
        const spec = featureSpec(tok, { key, ...row });
        if ( spec ) wanted.set(`${tok.id}|${key}`, spec);
      }
    }
  }
  const seen = new Set();
  const removeArea = async region => { await liftAll(region); const t = scene.templates.get(region.id); if ( t ) await t.delete().catch(() => {}); if ( scene.regions.get(region.id) ) await region.delete().catch(() => {}); };
  for ( const region of scene.regions.filter(r => flagOf(r)?.kind === "feature") ) {
    const f = flagOf(region);
    const id = `${f.tokenId}|${f.key}`;
    const w = wanted.get(id);
    // Not wanted, or a second area for the same aura (a race before the sweep was serialized):
    // lifted and deleted. One aura, one area.
    if ( !w || seen.has(id) ) { await removeArea(region); continue; }
    seen.add(id);
    wanted.delete(id);
    const beh = behaviorOf(region);
    const template = scene.templates.get(region.id);
    const distance = w.range + (w.tok.width * scene.grid.distance) / 2;
    if ( template && (template.distance !== distance) ) await template.update({ distance });
    if ( beh ) {
      const upd = {};
      if ( beh.disabled !== w.disabled ) upd.disabled = w.disabled;
      if ( !foundry.utils.objectsEqual(beh.system.effect?.changes ?? null, w.effect.changes) ) upd["system.effect"] = w.effect;
      if ( !foundry.utils.isEmpty(upd) ) await beh.update(upd);
    }
    await reconcileMembers(region);
  }
  for ( const w of wanted.values() ) {
    try {
      // A TEMPLATE, like a spell's: it draws the ring the table sees (user: "the black circle,
      // not the green area"), and its Region — same id, attached to the token — is the machine.
      // Centred on the token, the class's range plus half the token (an emanation measures from
      // the edge). No dnd5e flags: a feature's aura demands no save, so the saves machine's
      // template adoption must never see it as an area of anything.
      const [template] = await scene.createEmbeddedDocuments("MeasuredTemplate", [{
        t: "circle", x: w.tok.x + (w.tok.width * scene.grid.size) / 2, y: w.tok.y + (w.tok.height * scene.grid.size) / 2,
        distance: w.range + (w.tok.width * scene.grid.distance) / 2,
        fillColor: colorFor(w.row.reach),
        flags: { [MODULE_ID]: { [FLAG]: { kind: "feature", key: w.row.key, tokenId: w.tok.id, itemUuid: w.item.uuid } } }
      }]);
      const region = template ? (scene.regions.get(template.id) ?? await new Promise(r => setTimeout(() => r(scene.regions.get(template.id)), 400))) : null;
      if ( !region ) { console.error(`${TITLE} | ${w.row.key} around ${w.actor.name}: the template's region never appeared.`); continue; }
      await adoptRegion(region, { kind: "feature", key: w.row.key, tok: w.tok, itemUuid: w.item.uuid, reach: w.row.reach, effect: w.effect, disabled: w.disabled });
      await announce(w.row, w.actor, w.item, w.range, w.effect, "stands");
      await reconcileMembers(scene.regions.get(region.id) ?? region);
    } catch(err) {
      console.error(`${TITLE} | Could not raise ${w.row.key} around ${w.actor.name}.`, err);
    }
  }
  // The spells' floors too: a scene going active or inactive changes what every emanation on it
  // applies, and a spell's region is otherwise floored only by its own events.
  for ( const region of scene.regions.filter(r => flagOf(r)?.kind === "spell") ) await reconcileMembers(region);
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
    await adoptRegion(region, { kind: "spell", key: row.key, tok, itemUuid, reach: row.reach, scaling,
      effect: (effect && !resolved.unresolved.length) ? { name: effect.name, img: effect.img ?? item.img ?? null, description: row.rule, changes: resolved.changes } : null });
    const size = activitySizeOf(item, rollData);
    await announce(row, actor, item, size ?? region.shapes[0]?.radiusX ?? null, effect ? { name: effect.name, changes: resolved.changes } : null, "is cast",
      { activity: [...(item.system?.activities ?? [])].find(a => a.type === "save") ?? null, regionId: region.id });
    await reconcileMembers(region);
  } catch(err) {
    console.error(`${TITLE} | Could not adopt a spell's emanation — its effects apply by hand.`, err);
  }
}

/* --- the cast: a spell's emanation places itself on the caster ---------------------------------- */

/** A listed spell row whose activity is an emanation from the caster (a `radius` template, range self). */
function castEmanationRow(activity) {
  if ( !live() || (activity?.item?.type !== "spell") ) return null;
  const row = rowNamed(activity.item.name);
  if ( !row || (row.kind !== "spell") || !listed().has(lower(row.key)) ) return null;
  const tpl = activity.target?.template;
  if ( (tpl?.type !== "radius") || !(Number(tpl?.size) > 0) ) return null;
  if ( (activity.range?.units ?? "self") !== "self" ) return null;
  return row;
}

// The caster is not asked to click the area down (user, 2026-09-03: "I shouldn't need to place
// the template, it should just put it where the caster's token is"): the system's own placement
// prompt is switched off for a listed emanation spell, and the template is placed here on the
// casting client — centred on the caster's token, the spell's size plus half the token (an
// emanation measures from the edge), carrying the flags the system would have written (origin,
// item, spell level), and made the concentration effect's dependent so it ends with the spell.
// From there nothing is new: the region appears, the GM adopts it, the saves machine's floor
// adopts the template into the cast's demand.
Hooks.on("dnd5e.preUseActivity", (activity, usageConfig) => {
  try {
    if ( !castEmanationRow(activity) ) return;
    usageConfig.create ??= {};
    usageConfig.create.measuredTemplate = false;
  } catch(err) { console.warn(`${TITLE} | Could not switch off the template prompt.`, err); }
});

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  try {
    const row = castEmanationRow(activity);
    if ( !row ) return;
    if ( (results?.templates ?? []).flat().length ) return;   // the system placed one after all
    const actor = activity.actor;
    if ( !actor?.isOwner ) return;
    void placeCastEmanation(activity, row, results?.message instanceof ChatMessage ? results.message : null);
  } catch(err) { console.error(`${TITLE} | Could not place the emanation — place the template by hand.`, err); }
});

async function placeCastEmanation(activity, row, message) {
  const actor = activity.actor;
  const tok = actor.token ?? actor.getActiveTokens?.(true, true)?.[0] ?? null;
  const scene = tok?.parent;
  if ( !tok || !scene ) return;
  const size = Number(activity.target.template.size);
  const half = (tok.width * scene.grid.distance) / 2;
  const spellLevel = Number(message?.system?.spellLevel ?? activity.item.system?.level ?? 0) || activity.item.system?.level;
  // The concentration effect for this cast owns the area: dnd5e 5.2+ tracks a dependent by the
  // `dependentOn` flag ON THE DEPENDENT, registered when it is created — so the flag goes into
  // the create data (the deprecated `addDependent` after the fact never reached the registry).
  // The system deletes dependents when concentration ends; the region goes with the template.
  const conc = [...(actor.concentration?.effects ?? [])].find(e => (e.getFlag?.("dnd5e", "item")?.id === activity.item.id) || (e.flags?.dnd5e?.item?.id === activity.item.id))
    ?? [...(actor.concentration?.effects ?? [])].at(-1) ?? null;
  await scene.createEmbeddedDocuments("MeasuredTemplate", [{
    t: "circle", x: tok.x + (tok.width * scene.grid.size) / 2, y: tok.y + (tok.height * scene.grid.size) / 2,
    distance: size + half,
    flags: { dnd5e: { origin: activity.uuid, item: activity.item.uuid, spellLevel, ...(conc ? { dependentOn: conc.uuid } : {}) } }
  }]);
  // The type picked in the CASTING WINDOW (below) is written onto the emanation card the GM posts
  // as the area is adopted — the card's own buttons can still change it later. No dialog shown
  // (a fast-forward cast): the alignment's default stands, no extra click (N4).
  void carryDamageTypeChoice(activity);
}

/* --- the casting window: a damage type the part leaves open is picked THERE ------------------- */

// The same idiom as the gate's fieldset in the roll dialogs (DESIGN §5): the system's own
// usage dialog, one fieldset added on its public render hook (user, 2026-09-03: "I would have
// preferred it be inserted in the casting initial window"). Radios per type the part offers,
// the alignment's answer checked; the pick rides in memory on the casting client until the cast
// lands, then goes onto the card.
const pendingTypes = new Map();   // activity uuid → type picked in the dialog
Hooks.on("renderActivityUsageDialog", (app, element) => {
  try {
    const activity = app?.activity ?? app?.options?.activity ?? null;
    if ( !castEmanationRow(activity) ) return;
    const types = partTypesOf(activity);
    if ( (types.length < 2) || element.querySelector("[data-bf-emanation-type-field]") ) return;
    const alignment = activity.actor?.system?.details?.alignment ?? null;
    const current = pendingTypes.get(activity.uuid) ?? damageTypeFor(types, alignment).type;
    const why = damageTypeFor(types, alignment).why;
    const cap = s => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
    const fs = document.createElement("fieldset");
    fs.dataset.bfEmanationTypeField = "";
    fs.innerHTML = `<legend>Battle Flow — damage type</legend>
      <div class="form-group"><label>${activity.item.name} deals</label>
        <div class="form-fields" style="gap:0.75rem;">${types.map(t => `<label style="display:flex;align-items:center;gap:0.3rem;"><input type="radio" name="bf-emanation-type" value="${t}" ${t === current ? "checked" : ""}> ${cap(t)}</label>`).join("")}</div>
        <p class="hint">${cap(current)} is the default — ${why}. The pick applies to every roll of this cast; the spell's card can change it later.</p></div>`;
    for ( const r of fs.querySelectorAll('input[name="bf-emanation-type"]') ) r.addEventListener("change", () => { if ( r.checked ) pendingTypes.set(activity.uuid, r.value); });
    const footer = element.querySelector("footer, .form-footer");
    if ( footer ) footer.before(fs); else (element.querySelector("form") ?? element).appendChild(fs);
  } catch(err) { console.warn(`${TITLE} | Could not add the damage-type fieldset.`, err); }
});

async function carryDamageTypeChoice(activity) {
  try {
    const type = pendingTypes.get(activity.uuid) ?? null;
    pendingTypes.delete(activity.uuid);
    if ( !type ) return;
    let card = null;
    for ( let i = 0; (i < 40) && !card; i++ ) { await new Promise(r => setTimeout(r, 250)); card = emanationCardFor(activity.uuid); }
    if ( !card ) return;   // no GM adopted the area — no card to carry it
    if ( card.getFlag(MODULE_ID, "emanationCard")?.damageType !== type ) await chooseDamageType(card, type);
  } catch(err) {
    console.warn(`${TITLE} | The damage-type pick could not be carried to the card — its buttons still can.`, err);
  }
}

// The spell ends when concentration does. dnd5e 5.3 does NOT delete a placed template on
// endConcentration (measured, smoke-emanations §8: the template stood after the effect went),
// and the saves machine's own duration sweep waits for every verdict to land. So the area this
// module adopted goes here, on the GM, the moment the concentration effect for its activity is
// deleted: the template (its region follows, v14 shares the id) or the bare region.
Hooks.on("deleteActiveEffect", effect => {
  if ( !isActiveGM() || !effect?.statuses?.has?.("concentrating") ) return;
  void endCastEmanations(effect);
});
async function endCastEmanations(effect) {
  try {
    const activityUuid = effect.flags?.dnd5e?.activity?.uuid ?? null;
    if ( !activityUuid ) return;
    for ( const scene of game.scenes ) {
      for ( const region of scene.regions.filter(r => (flagOf(r)?.kind === "spell") && (r.getFlag("dnd5e", "origin") === activityUuid)) ) {
        const template = scene.templates.get(region.id);
        if ( template ) await template.delete().catch(() => {});
        if ( scene.regions.get(region.id) ) await region.delete().catch(() => {});
      }
    }
  } catch(err) {
    console.error(`${TITLE} | Could not end an emanation with its concentration — delete the area by hand.`, err);
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

/** The types a save activity's first damage part offers, in the pack's order. */
const partTypesOf = activity => [...(activity?.damage?.parts?.[0]?.types ?? [])].map(t => String(t).toLowerCase());

async function announce(row, actor, item, range, effect, verb, { activity = null, regionId = null } = {}) {
  try {
    const reach = row.reach === "helpful" ? "allies and neutrals inside" : "enemies inside";
    const rangeText = range ? `${range}-foot Emanation` : "Emanation";
    // A damage part with several types (Spirit Guardians: necrotic OR radiant) is a choice the
    // card carries: the alignment's answer as the default, the caster's pick when made.
    const types = partTypesOf(activity);
    const alignment = actor?.system?.details?.alignment ?? null;
    const choice = (types.length > 1) ? { types, activityUuid: activity.uuid, alignment, ...damageTypeFor(types, alignment) } : null;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: bfCard({
        img: item?.img ?? null, eyebrow: "Emanation", tone: row.reach === "helpful" ? "good" : "bad",
        title: `${row.key} — ${actor?.name ?? ""} — ${rangeText}`,
        subtitle: effect ? `${reach}: ${effect.name} — ${describeChanges(effect.changes)}${row.trigger ? " · a save on entering and on ending a turn inside" : ""}` : (row.trigger ? "a save on entering and on ending a turn inside" : reach),
        lines: [ruleLine(row.rule), row.caveat ? `<span style="opacity:0.8;">${row.caveat}</span>` : null]
      }),
      flags: { [MODULE_ID]: { emanationCard: { ...statContext(actor?.uuid ?? null), key: row.key, verb, range: range ?? null, regionId,
        ...(choice ? { types: choice.types, activityUuid: choice.activityUuid, damageType: choice.type, damageWhy: choice.why, chosen: false } : {}) } } }
    });
  } catch(err) {
    console.warn(`${TITLE} | Could not post the emanation card.`, err);
  }
}

/* --- the damage type: the alignment's by default, the caster's by choice ----------------------- */

/** The cast's emanation card for this activity — the newest one, where the pick lives. */
function emanationCardFor(activityUuid) {
  return game.messages.contents.filter(m => m.getFlag(MODULE_ID, "emanationCard")?.activityUuid === activityUuid).at(-1) ?? null;
}

// The pick is a fold onto the card (R2): the GM writes it straight, a player's click travels as
// an envelope the driving client folds — the relay idiom every answer in this module rides.
registerRelay("emanationTypeAnswer", {
  flagKey: "emanationCard",
  targetOf: a => a.cardId,
  owns: flag => drivesMomentFor(flag?.sourceUuid ?? null),
  fold: (current, a) => {
    if ( !current.types?.includes(a.type) ) return false;
    current.damageType = a.type; current.damageWhy = "chosen"; current.chosen = true;
  },
  cleanup: true
});

async function chooseDamageType(card, type) {
  const flag = card.getFlag(MODULE_ID, "emanationCard");
  if ( !flag?.types?.includes(type) ) return;
  if ( card.canUserModify?.(game.user, "update") ) {
    await card.setFlag(MODULE_ID, "emanationCard", { ...flag, damageType: type, damageWhy: "chosen", chosen: true });
    return;
  }
  await ChatMessage.create({ whisper: [game.user.id], speaker: { alias: TITLE }, content: `<p>${type}</p>`,
    flags: { [MODULE_ID]: { emanationTypeAnswer: { cardId: card.id, type } } } });
}

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const f = message.getFlag(MODULE_ID, "emanationCard");
  if ( !f?.types?.length ) return;
  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:0.35rem;align-items:center;margin-top:0.35rem;flex-wrap:wrap;";
  const label = document.createElement("span");
  label.style.cssText = "font-size:var(--font-size-11,11px);opacity:0.75;";
  label.textContent = f.chosen ? "Damage type — chosen:" : `Damage type — ${f.damageWhy}:`;
  row.appendChild(label);
  for ( const type of f.types ) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.bfEmanationType = type;
    const on = type === f.damageType;
    b.style.cssText = `font-size:var(--font-size-11,11px);padding:0.15rem 0.6rem;border-radius:3px;line-height:1.4;`
      + (on ? "font-weight:bold;border:2px solid rgba(70,150,95,0.95);" : "opacity:0.75;");
    b.textContent = `${type.charAt(0).toUpperCase()}${type.slice(1)}${on ? " ✓" : ""}`;
    b.addEventListener("click", ev => { ev.preventDefault(); void chooseDamageType(message, type); });
    row.appendChild(b);
  }
  html.querySelector(".message-content")?.appendChild(row);
});

// Every roll of the cast wears the type: the save activity's own damage roll — the cast's, the
// triggers' — carries the card's pick, or the alignment's default when no card stands yet (the
// cast's first roll can land before the card does).
Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
  try {
    const activity = config.subject;
    if ( (activity?.type !== "save") || !live() ) return;
    const row = rowNamed(activity.item?.name);
    if ( !row || (row.kind !== "spell") || !listed().has(lower(row.key)) ) return;
    const types = partTypesOf(activity);
    if ( types.length < 2 ) return;
    const card = emanationCardFor(activity.uuid);
    const chosen = card?.getFlag(MODULE_ID, "emanationCard")?.damageType ?? null;
    const { type } = damageTypeFor(types, activity.actor?.system?.details?.alignment ?? null, chosen);
    if ( !type ) return;
    for ( const roll of config.rolls ?? [] ) {
      const offered = [...(roll.options?.types ?? [])].map(t => String(t).toLowerCase());
      if ( offered.includes(type) ) { roll.options ??= {}; roll.options.type = type; }
    }
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.emanationType`, { type, chosen: !!chosen });
  } catch(err) {
    console.warn(`${TITLE} | Could not set the emanation's damage type — the roll wears the pack's first.`, err);
  }
});

/* --- the hooks: when to look ---------------------------------------------------------------- */

// The switch or the list moved (settings.js says so on change): every scene that carries an
// emanation, and the active one, is swept — off removes what stands, on raises it again.
/** The active scene, and every scene that carries an emanation: raised on the one, brought down on the others. */
const sweepEverywhere = () => {
  for ( const s of game.scenes ) if ( (s === game.scenes.active) || s.regions.some(r => flagOf(r)) ) scheduleScene(s);
};
Hooks.once("ready", sweepEverywhere);   // every scene that carries one, not just the active: the others come down
Hooks.on(`${MODULE_ID}.emanationsChanged`, sweepEverywhere);
// The active scene moved: the scene that was active lifts everything its emanations wrote, the
// one now active applies its own. Both updates carry `active` (the old scene's goes false).
Hooks.on("updateScene", (_scene, changes) => { if ( ("active" in changes) && isActiveGM() ) sweepEverywhere(); });
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
