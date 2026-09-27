/**
 * Battle Flow — Emanations: an aura applies itself to the creatures inside it, and the platform keeps the geometry and the clock.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 * Owns the lifecycle of the rings, the floor that keeps member effects true, and the triggers.
 * Only the active GM writes. Rulings: RULINGS *Emanations*.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, activeCombatFor, statContext, whisperNoGM, drivesMomentFor } from "./core.js";
import { saveDemandData, saveTargetEntry } from "./decide/demand.js";
import { lower, itemNamed, activityNamed, activityOfType, resolveUuid } from "./lookup.js";
import { emanationEntries, listedNames } from "./settings.js";
import { reactionSpent, turnChitStands, writeTurnChit } from "./shared.js";
import { riderPartFormula } from "./decide/clock.js";
import { tokensInRegions } from "./geometry.js";
import { emanationShapeData } from "./decide/geometry.js";
import { castLevelOn } from "./decide/card.js";
import { bfCard, ruleLine } from "./decide/present.js";
import { EMANATIONS, tableIndex } from "./decide/registry.js";
import { pulseFormKey, reachAdmits, resolveChanges, emanationRange, triggerDue, healTriggerDue, memberEffectData, damageTypeFor, appliesOnScene, liveScenes, emanationGroup, groupMembers } from "./decide/emanations.js";
import { canAnswerFor } from "./core.js";
import { momentButton, registerRelay } from "./ui.js";
import { rollDamageForSave } from "./auto-damage.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { SURFACES } from "./surfaces.js";

// An attached Region does the geometry and raises enter/exit/turn events (NOTES *v14 models an emanation end to end*).
// The pack's formulas resolve against the WEARER, so a member's effect has the source's numbers read in.

const FLAG = "emanation";                       // on the region, and on every member effect
const TYPE = `${MODULE_ID}.emanation`;          // the behaviour type this module registers
const STATUS = "bfEmanation";                   // the status a member effect wears, so the token shows it
const listed = () => listedNames(emanationEntries());
const { rowNamed } = tableIndex(EMANATIONS);
const live = () => setting(S.emanations);
const colorFor = reach => (reach === "harmful") ? "#b4463c" : "#46965f";   // TONE.bad / TONE.good, solid — a Region colour is a hex
/** ⚠ LAYER visibility alone still draws the ring on the Regions layer; only LOCKED + LAYER_UNLOCKED is never drawn. */
const RING_VISIBILITY = () => CONST.REGION_VISIBILITY.LAYER_UNLOCKED;
/** The visibility fields every ring wears: never drawn, unlocked by hand to see it. */
const ringHidden = () => ({ visibility: RING_VISIBILITY(), locked: true });

/** ⚠ A token's committed placement, never an animation frame: a ring raised off interim x/y drifts for good (NOTES *An attached emanation is RE-BASED*). */
const standing = tok => ({ x: tok._source?.x ?? tok.x, y: tok._source?.y ?? tok.y,
  width: tok._source?.width ?? tok.width, height: tok._source?.height ?? tok.height, shape: tok._source?.shape ?? tok.shape });

const behaviorOf = region => region?.behaviors?.find(b => b.type === TYPE) ?? null;
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
        reach: new F.StringField({ initial: "helpful", choices: { helpful: "Allies and neutrals", harmful: "Enemies", all: "Every creature" }, label: "Reach" }),
        scaling: new F.NumberField({ integer: true, min: 0, initial: 0, label: "Upcast levels" }),
        effect: new F.ObjectField({ nullable: true, initial: null, label: "Effect", hint: "The pack's effect with the source's numbers read in." })
      };
    }
    // biome-ignore-start lint/complexity/noThisInStatic: Foundry calls a region behavior's event handlers with `this` bound to the behavior instance
    /** GM-side: the region's membership changed under this token. */
    static async #onEnter(event) { if ( !gmHandles(event) ) return; await reconcileMembers(this.region); await maybeTrigger(this, event.data?.token ?? null, "enter"); }
    static async #onExit(event) { if ( !gmHandles(event) ) return; await forgetInitial(this.region, event.data?.token ?? null); await reconcileMembers(this.region); }
    static async #onTurnEnd(event) { if ( !gmHandles(event) ) return; await maybeTrigger(this, event.data?.token ?? event.data?.combatant?.token ?? null, "turnEnd"); }
    static async #onTurnStart(event) { if ( !gmHandles(event) ) return; await maybeHeal(this, event.data?.token ?? event.data?.combatant?.token ?? null, "turnStart"); }
    static async #onToggle(event) { if ( !gmHandles(event) ) return; await reconcileMembers(this.region); }
    static async #onMoveIn(event) { if ( !gmHandles(event) ) return; await maybeAlert(this, event.data?.token ?? null, event.data?.movement ?? null); }
    // biome-ignore-end lint/complexity/noThisInStatic: Foundry calls a region behavior's event handlers with `this` bound to the behavior instance
    static events = {
      [EV.TOKEN_ENTER]: this.#onEnter,
      [EV.TOKEN_EXIT]: this.#onExit,
      [EV.TOKEN_TURN_END]: this.#onTurnEnd,
      [EV.TOKEN_TURN_START]: this.#onTurnStart,
      [EV.TOKEN_MOVE_IN]: this.#onMoveIn,
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

/** The scenes play is on now (decide/emanations.js liveScenes). `viewedScene` has no update hook (watchLive). */
const liveNow = () => liveScenes(game.scenes.active?.id ?? null,
  game.users.filter(u => u.active).map(u => ({ sceneId: u.viewedScene ?? null, name: u.name, isGM: u.isGM })));

/** Only a LIVE scene's emanations apply (decide/emanations.js appliesOnScene). */
const appliesHere = (region, scenes = liveNow()) => appliesOnScene(region?.parent?.id ?? null, scenes).applies;

/** The aura a region carries, as one thing across every scene it stands on (decide/emanations.js emanationGroup). */
const groupOf = region => {
  const f = flagOf(region);
  const sys = behaviorOf(region)?.system;
  return emanationGroup(f?.itemUuid ?? sys?.item ?? null, f?.key ?? sys?.key ?? null, region?.id ?? "");
};

/** Every region of this aura on every scene, the active scene's first. */
function regionsOfGroup(group) {
  const out = [];
  const active = game.scenes.active;
  for ( const scene of [active, ...game.scenes.filter(s => s !== active)] ) {
    for ( const region of scene?.regions ?? [] ) if ( flagOf(region) && (groupOf(region) === group) ) out.push(region);
  }
  return out;
}

/** This aura's member effects on this actor: stamped with its group, or naming one of its regions. */
const memberEffects = (actor, group, regionIds) => actor?.effects?.filter(e => {
  const f = e.getFlag(MODULE_ID, FLAG);
  return !!f && ((f.group === group) || regionIds.has(f.regionId));
}) ?? [];

/** Everyone who could wear this aura's effect: its scenes' token actors AND every world actor (a linked actor outlives its token). */
function holdersOf(regions) {
  const out = new Set();
  for ( const scene of new Set(regions.map(r => r.parent).filter(Boolean)) ) {
    for ( const tok of scene.tokens ) if ( tok.actor ) out.add(tok.actor);
  }
  for ( const actor of game.actors ) out.add(actor);
  return out;
}

/**
 * Apply the standing effect to every member, lift it from everyone else: one copy per aura across
 * all its regions (decide/emanations.js groupMembers). `gone` is a region being deleted.
 * ⚠ Membership is the containment test (geometry.js), never `region.tokens`, which lags a create or move.
 * ⚠ Serialized per aura: one move fires three events in a tick, and parallel floors double-write.
 */
const reconciling = new Map();
function reconcileMembers(region, { gone = null } = {}) {
  if ( !region?.id ) return Promise.resolve();
  const group = groupOf(region);
  const prev = reconciling.get(group) ?? Promise.resolve();
  const run = prev.then(() => reconcileAuraNow(group, gone));
  reconciling.set(group, run);
  return run.finally(() => { if ( reconciling.get(group) === run ) reconciling.delete(group); });
}
async function reconcileAuraNow(group, gone) {
  try {
    if ( !isActiveGM() ) return;
    const regions = regionsOfGroup(group).filter(r => r.id !== gone?.id);
    const regionIds = new Set([...regions.map(r => r.id), ...(gone ? [gone.id] : [])]);
    const liveSet = liveNow();
    const actorsByKey = new Map();
    const byRegion = new Map();
    const areas = regions.map(region => {
      const beh = behaviorOf(region);
      const sys = beh?.system;
      const row = sys ? rowNamed(sys.key) : null;
      const source = sys?.source ? fromUuidSync(sys.source) : null;
      const applies = !!beh && !beh.disabled && !!row && !!sys.effect && live() && listed().has(lower(row.key)) && appliesHere(region, liveSet);
      byRegion.set(region.id, { region, sys, row, source });
      const inside = [];
      for ( const entry of (applies ? tokensInRegions([region]) : null) ?? [] ) {
        const tok = region.parent.tokens.get(entry.tokenId);
        if ( !tok?.actor ) continue;
        actorsByKey.set(tok.actor.uuid, tok.actor);
        inside.push({ tokenId: tok.id, actorKey: tok.actor.uuid, disposition: tok.disposition });
      }
      return { regionId: region.id, applies, kind: row?.kind ?? "feature", reach: sys?.reach ?? "helpful",
        sourceTokenId: source?.id ?? null, sourceDisposition: source?.disposition ?? 1, inside };
    });
    const members = groupMembers(areas);
    for ( const [key, regionId] of members ) {
      const actor = actorsByKey.get(key);
      const { sys, row, source } = byRegion.get(regionId);
      const have = memberEffects(actor, group, regionIds);
      // One effect per aura per creature: any duplicate is tidied.
      if ( have.length > 1 ) await actor.deleteEmbeddedDocuments("ActiveEffect", have.slice(1).map(e => e.id));
      if ( have.length ) {
        // A copy missing its group or row key learns them, so it outlives the region it names.
        const f = have[0].getFlag(MODULE_ID, FLAG);
        if ( (f.group !== group) || (f.key !== row.key) ) await have[0].setFlag(MODULE_ID, FLAG, { ...f, group, key: row.key });
        continue;
      }
      await actor.createEmbeddedDocuments("ActiveEffect", [memberEffectData(row, sys.effect,
        { sourceName: source?.name ?? "the source", itemUuid: sys.item, regionId, group, moduleId: MODULE_ID, flagKey: FLAG, status: STATUS })]);
    }
    for ( const actor of holdersOf(gone?.parent ? [...regions, gone] : regions) ) {
      if ( members.has(actor.uuid) ) continue;
      const stale = memberEffects(actor, group, regionIds);
      if ( stale.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id)).catch(() => {});
    }
  } catch(err) {
    console.error(`${TITLE} | Emanation floor failed — check the aura's effects by hand.`, err);
  }
}

/* --- the trigger: a spell row's save, demanded of one creature over the bus ----------------- */

async function maybeTrigger(behType, token, cause) {
  try {
    if ( !isActiveGM() || !token?.actor ) return;
    const beh = behType.behavior;
    const sys = behType;   // the type instance IS the system data
    const row = rowNamed(sys.key);
    if ( !row?.trigger?.on.includes(cause) || beh.disabled || !live() || !listed().has(lower(row.key)) ) return;
    const region = behType.region;
    if ( !appliesHere(region) ) return;   // a ring on a scene nobody is playing on demands nothing
    const source = resolveUuid(sys.source);
    if ( source && (token.id === source.id) ) return;
    if ( !reachAdmits(sys.reach, source?.disposition ?? 1, token.disposition) ) return;
    // Inside at the cast = asked by the cast's demand: the area attaching around it is not an entry.
    if ( cause === "enter" ) {
      const f = flagOf(region);
      if ( f?.initial?.includes(token.id) ) { await forgetInitial(region, token); return; }
    }
    if ( !(region.tokens?.has?.(token) ?? true) && (cause === "turnEnd") ) return;   // ended its turn OUTSIDE
    const item = resolveUuid(sys.item);
    const activity = activityOfType(item, "save");
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
        saves: saveDemandData({
          stat: statContext(casterActor?.uuid ?? null),
          abilities, dc, damageOnSave: onSave, hasDamage,
          effectNames: { fail: [], always: [] }, effectsHandled: "emanation",
          // ⚠ Pinned: the area adoption keys on the activity this card shares with the cast and would rewrite the targets.
          pinnedTargets: true,
          activityUuid: activity.uuid, templateType: null, templated: false,
          durationUnits: item.system?.duration?.units ?? null,
          item: { name: item.name, img: item.img ?? null }, casterName: casterActor?.name ?? null,
          scaling: Number(sys.scaling ?? 0),
          window, deadline: window ? Date.now() + (window * 1000) : null,
          targets: [saveTargetEntry(actor.uuid, token.name)]
        }),
        emanationTrigger: { key: row.key, cause, regionId: region.id, targetUuid: actor.uuid, inCombat: !!combat, why: due.why }
      } }
    });
    if ( hasDamage && card ) await rollDamageForSave(activity, card);
  } catch(err) {
    console.error(`${TITLE} | Emanation trigger failed — ask for the save by hand.`, err);
  }
}

/* --- the alert: a creature moving INTO the ring reminds its source (Polearm Master's Reactive Strike) --- */

/**
 * An `alert` row: a creature that MOVED into the reach raises Hew's reminder (`hewNotice`), once per
 * movement. tokenMoveIn fires only for a mover, and a walked move is split at each region edge, so
 * passing through is caught.
 */
const alerted = new Set();
async function maybeAlert(behType, token, movement) {
  try {
    if ( !isActiveGM() || !token?.actor ) return;
    const sys = behType;
    const row = rowNamed(sys.key);
    if ( !row?.alert || (row.alert.on !== "moveIn") || behType.behavior?.disabled || !live() || !listed().has(lower(row.key)) ) return;
    const region = behType.region;
    if ( !appliesHere(region) ) return;
    const source = resolveUuid(sys.source);
    const bearer = source?.actor ?? null;
    if ( !bearer || (token.id === source.id) ) return;
    if ( !reachAdmits(sys.reach, source.disposition ?? 1, token.disposition) ) return;
    if ( reactionSpent(bearer) || bearer.statuses?.has?.("incapacitated") ) return;
    const key = `${region.id}|${token.id}|${movement?.id ?? Date.now()}`;
    if ( alerted.has(key) ) return;
    alerted.add(key);
    const item = resolveUuid(sys.item);
    const weapon = row.holding ? heldWeaponFor(bearer, row.holding) : null;
    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: bearer, token: source }),
      content: bfCard({ img: item?.img ?? null, eyebrow: `Feat — ${item?.name ?? row.key}`, tone: "good",
        title: `${row.alert.label} — ${token.name} entered ${bearer.name}'s reach`,
        subtitle: weapon ? `${weapon.name} · ${weaponReachOf(weapon)} ft` : "",
        lines: [ruleLine(row.rule), row.alert.swing] }),
      flags: { [MODULE_ID]: { hewNotice: {
        attackerUuid: bearer.uuid, itemName: item?.name ?? row.key, itemImg: item?.img ?? null,
        weaponName: weapon?.name ?? null, why: `${token.name} entered your reach`,
        label: row.alert.label, rule: row.rule, swing: row.alert.swing, targetName: token.name,
        ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
      } } }
    });
  } catch(err) {
    console.error(`${TITLE} | ${behType?.key ?? "An emanation"}'s reminder failed — the reaction is yours by hand.`, err);
  }
}

/* --- the heal: an area pays a member at a moment (Aura of Life) ------------------------------- */

/** The row's heal at the member's turn start: the activity's healing part, rolled on the caster, receipted (N1). */
async function maybeHeal(behType, token, cause) {
  try {
    if ( !isActiveGM() || !token?.actor ) return;
    const beh = behType.behavior;
    const sys = behType;
    const row = rowNamed(sys.key);
    if ( !row?.heal || beh.disabled || !live() || !listed().has(lower(row.key)) ) return;
    const region = behType.region;
    if ( !appliesHere(region) ) return;
    const source = resolveUuid(sys.source);
    if ( source && (token.id === source.id) ) return;
    if ( !reachAdmits(sys.reach, source?.disposition ?? 1, token.disposition) ) return;
    if ( !(region.tokens?.has?.(token) ?? true) ) return;
    const actor = token.actor;
    // ⚠ dnd5e marks a 0-HP creature `dead` itself: read the Hit Points, never the status.
    const due = healTriggerDue(row, { cause, hp: Number(actor.system?.attributes?.hp?.value ?? 0) });
    if ( !due.due ) return;
    const item = resolveUuid(sys.item);
    const activity = activityNamed(item, row.heal.activity);
    const part = activity?.healing;
    const raw = part ? riderPartFormula({ number: part.number, denomination: part.denomination, custom: part.custom, bonus: part.bonus }) : null;
    if ( !raw ) { console.warn(`${TITLE} | ${row.key}: no healing part on "${row.heal.activity}" — heal by hand.`); return; }
    const casterActor = item?.actor ?? null;
    const roll = await new Roll(raw, casterActor?.getRollData?.() ?? {}).evaluate();
    const type = [...(part.types ?? [])][0] ?? "healing";
    const card = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: casterActor, token: source ?? undefined }),
      content: bfCard({ img: item?.img ?? null, eyebrow: "Emanation", tone: "good",
        title: `${row.key} — ${actor.name} regains ${roll.total} Hit Point${roll.total === 1 ? "" : "s"}`,
        subtitle: `${due.why} inside ${source?.name ?? "the caster"}'s ${row.key}`,
        lines: [ruleLine(row.rule)] }),
      flags: { [MODULE_ID]: { emanationHeal: { ...statContext(casterActor?.uuid ?? null), key: row.key, regionId: region.id, targetUuid: actor.uuid, formula: raw, total: roll.total, why: due.why } } }
    });
    if ( card ) await applyDamagesWithReceipt(card, [{ uuid: actor.uuid, name: token.name }], [{ value: roll.total, type, properties: new Set() }], { note: row.key });
  } catch(err) {
    console.error(`${TITLE} | Emanation heal failed — heal by hand.`, err);
  }
}

/* --- the notice: a heal the caster AIMS is offered at their turn start, never played (Aura of Vitality) --- */

/** The turn moved: the current combatant's own spell emanations with a `remind` row say so on a card. */
Hooks.on("updateCombat", (combat, changes) => {
  try {
    if ( !isActiveGM() || !live() ) return;
    if ( !("turn" in changes) && !("round" in changes) ) return;
    if ( !combat.started ) return;
    const token = combat.combatant?.token ?? null;
    const scene = combat.scene ?? token?.parent ?? null;
    if ( !token || !scene ) return;
    const names = listed();
    for ( const region of scene.regions.filter(r => (flagOf(r)?.kind === "spell") && (flagOf(r)?.tokenId === token.id)) ) {
      const row = rowNamed(flagOf(region).key);
      if ( !row?.remind || (row.remind.on !== "sourceTurnStart") || !names.has(lower(row.key)) || !appliesHere(region) ) continue;
      void remind(region, row, token);
    }
  } catch(err) {
    console.error(`${TITLE} | Emanation notice failed.`, err);
  }
});

async function remind(region, row, token) {
  const sys = behaviorOf(region)?.system;
  const item = sys?.item ? fromUuidSync(sys.item) : null;
  const activity = activityNamed(item, row.remind.activity);
  const caster = item?.actor ?? token.actor ?? null;
  const inside = [...(region.tokens ?? [])].filter(t => t.id !== token.id).map(t => t.name);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token }),
    content: bfCard({ img: item?.img ?? null, eyebrow: "Emanation", tone: "pending",
      title: `${row.key} — ${caster?.name ?? token.name}'s turn: ${activity?.name ?? row.remind.activity} is yours to use`,
      subtitle: inside.length ? `inside the aura: ${inside.join(", ")}` : "nobody else stands inside the aura",
      lines: [ruleLine(row.rule), row.caveat ? `<span style="opacity:0.8;">${row.caveat}</span>` : null] }),
    flags: { [MODULE_ID]: { emanationRemind: { ...statContext(caster?.uuid ?? null), key: row.key, regionId: region.id, activityUuid: activity?.uuid ?? null, activityName: activity?.name ?? row.remind.activity } } }
  });
}

// The notice's button: the caster's client uses the activity on whatever they have targeted.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const r = message.getFlag(MODULE_ID, "emanationRemind");
  if ( !r?.activityUuid ) return;
  const caster = resolveUuid(r.sourceUuid);
  if ( !canAnswerFor(caster) ) return;
  const holder = html.querySelector(SURFACES.messageContent);
  if ( !holder ) return;
  holder.appendChild(momentButton(`Use ${r.activityName}`, () => {
    // live only: the button USES the ability, and a used-up item cannot be used — the warning below is the answer
    const activity = fromUuidSync(r.activityUuid);
    if ( !activity ) { ui.notifications.warn(`${TITLE}: ${r.activityName} is no longer on the sheet.`); return; }
    if ( !game.user.targets.size ) { ui.notifications.warn(`${TITLE}: target the creature to heal first, then press again.`); return; }
    void activity.use({}, {}, {});
  }));
});

/* --- the pulse: the bearer's turn ends, everyone inside takes the form's damage (Inner Radiance) --- */

/**
 * The pulse fires on the BEARER's turn end, which no region event carries (the bearer is not inside
 * its own ring). Rolled once on the bearer, applied to everyone inside. Forward moves only, once per turn.
 */
const pulsed = new Set();   // `${regionId}|${round}|${turn}` — the ended turns already paid
Hooks.on("updateCombat", (combat, changes, options) => {
  try {
    if ( !isActiveGM() || !live() ) return;
    if ( !("turn" in changes) && !("round" in changes) ) return;
    if ( !combat.started || (options?.direction === -1) ) return;
    const prev = combat.previous ?? null;
    const ended = prev?.combatantId ? combat.combatants.get(prev.combatantId) : null;
    const token = ended?.token ?? null;
    const scene = token?.parent ?? null;
    if ( !token || !scene ) return;
    const names = listed();
    for ( const region of scene.regions.filter(r => (flagOf(r)?.kind === "feature") && (flagOf(r).tokenId === token.id)) ) {
      const row = rowNamed(flagOf(region).key);
      if ( !row?.pulse || (row.pulse.on !== "sourceTurnEnd") || !names.has(lower(row.key)) || !appliesHere(region) ) continue;
      const beh = behaviorOf(region);
      if ( !beh || beh.disabled ) continue;
      const key = `${region.id}|${prev.round}|${prev.turn}`;
      if ( pulsed.has(key) ) continue;
      pulsed.add(key);
      void pulse(region, row, token, beh.system);
    }
  } catch(err) {
    console.error(`${TITLE} | Emanation pulse failed — apply its damage by hand.`, err);
  }
});

/** The pulse's damage off the row's activity: its formula as the pack wrote it, and its type. */
function pulseDamageOf(item, row) {
  const activity = activityNamed(item, row.pulse?.activity ?? row.activity);
  const part = activity?.damage?.parts?.[0] ?? null;
  const raw = part ? riderPartFormula({ number: part.number, denomination: part.denomination, custom: part.custom, bonus: part.bonus }) : null;
  return { activity, raw, type: [...(part?.types ?? [])][0] ?? null };
}

async function pulse(region, row, token, sys) {
  try {
    const item = resolveUuid(sys?.item);
    const bearer = item?.actor ?? token.actor ?? null;
    if ( !item || !bearer ) return;
    const { raw, type } = pulseDamageOf(item, row);
    if ( !raw ) { console.warn(`${TITLE} | ${row.key}: no damage part on "${row.pulse.activity}" — apply the pulse by hand.`); return; }
    const inside = (tokensInRegions([region]) ?? [])
      .map(e => region.parent.tokens.get(e.tokenId))
      .filter(t => t?.actor && (t.id !== token.id) && reachAdmits(sys.reach, token.disposition, t.disposition));
    if ( !inside.length ) return;
    const roll = await new Roll(raw, bearer.getRollData()).evaluate();
    const names = inside.map(t => t.name).join(", ");
    const card = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: bearer, token }),
      rolls: [roll],
      content: bfCard({ img: item.img ?? null, eyebrow: "Emanation", tone: "bad",
        title: `${row.key} — ${roll.total} ${type ?? ""} damage at the end of ${token.name}'s turn`.replace(/\s+/g, " "),
        subtitle: `every creature within the aura: ${names}`,
        lines: [ruleLine(row.rule)] }),
      flags: { [MODULE_ID]: { emanationPulse: { ...statContext(bearer.uuid), key: row.key, regionId: region.id,
        formula: raw, total: roll.total, type, targets: inside.map(t => ({ uuid: t.actor.uuid, name: t.name })) } } }
    });
    if ( card ) await applyDamagesWithReceipt(card, inside.map(t => ({ uuid: t.actor.uuid, name: t.name })),
      [{ value: roll.total, type: type ?? "radiant", properties: new Set(["mgc"]) }], { note: row.key });
  } catch(err) {
    console.error(`${TITLE} | ${row?.key ?? "An emanation"}'s pulse failed — apply its damage by hand.`, err);
  }
}

/** Drop a token from the region's "asked at the cast" record. */
async function forgetInitial(region, token) {
  const f = flagOf(region);
  if ( !token || !f?.initial?.includes(token.id) ) return;
  await region.setFlag(MODULE_ID, FLAG, { ...f, initial: f.initial.filter(id => id !== token.id) }).catch(() => {});
}

/** Make a Region this module's emanation: flagged (with who stood inside), given the behaviour, attached. */
async function adoptRegion(region, { kind, key, tok, itemUuid, reach, scaling = 0, effect = null, disabled = false }) {
  // ⚠ ORDER: the "asked at the cast" record goes down FIRST, before the behaviour and attachment
  // raise tokenEnter. Geometry, not `region.tokens`, which is still empty on a new region.
  const inside = (tokensInRegions([region]) ?? []).map(e => e.tokenId);
  const initial = inside.filter(id => id && (id !== tok?.id));
  await region.update({
    color: colorFor(reach), ...ringHidden(), highlightMode: "shapes",
    flags: { [MODULE_ID]: { [FLAG]: { kind, key, tokenId: tok?.id ?? null, itemUuid, initial } } }
  });
  await region.createEmbeddedDocuments("RegionBehavior", [{ type: TYPE, name: key, disabled,
    system: { key, source: tok?.uuid ?? null, item: itemUuid, reach, scaling, effect } }]);
  if ( tok && (region.attachment?.token?.id !== tok.id) ) await region.update({ attachment: { token: tok.id } });
}

/** The scene's pixels per unit of distance — a range in the scene's units, as a region radius. */
const pxPerUnit = scene => scene.grid.size / scene.grid.distance;

/**
 * Refuse the platform's own `dnd5e.*` behaviours on an adopted ring or a listed emanation spell's
 * region, so a ring never carries two standing effects (they admit no neutrals, fire no turn events).
 */
Hooks.on("preCreateRegionBehavior", (behavior, data) => {
  try {
    if ( !String(data?.type ?? "").startsWith("dnd5e.") ) return;
    const region = behavior?.parent;
    if ( !region ) return;
    if ( flagOf(region) ) return false;
    const item = resolveUuid(region.getFlag("dnd5e", "item"));
    const row = item ? rowNamed(item.name) : null;
    if ( row && (row.kind === "spell") && live() && listed().has(lower(row.key)) ) return false;
  } catch(err) {
    console.warn(`${TITLE} | Could not judge a region behaviour — the platform's stands.`, err);
  }
});

/* --- the lifecycle: a feature's emanation stands with its token ------------------------------- */

/** The activity's size resolved on the source (it may be a formula): the given activity's, else the item's first. */
function activitySizeOf(item, rollData, activity = null) {
  const act = activity ?? item?.system?.activities?.contents?.[0];
  const raw = act?._source?.target?.template?.size ?? act?.target?.template?.size ?? null;
  if ( (raw === null) || (raw === "") ) return null;
  const n = Number(raw);
  if ( Number.isFinite(n) ) return n;
  try { const r = Roll.replaceFormulaData(String(raw), rollData); return Roll.validate(r) ? Roll.safeEval(r) : null; } catch { return null; }
}

/** The equipped weapon a `holding` row asks for — a named base item, or every named property — or null. */
function heldWeaponFor(actor, holding) {
  return actor.items.find(i => (i.type === "weapon") && (i.system?.equipped === true) && (
    (holding.base ?? []).includes(i.system?.type?.baseItem ?? "")
    || (!!holding.properties?.length && holding.properties.every(p => i.system?.properties?.has?.(p))))) ?? null;
}

/** A weapon's reach in feet: its own, else 10 with the Reach property, else 5 (the 2024 rule). */
function weaponReachOf(weapon) {
  const own = Number(weapon?.system?.range?.reach);
  if ( Number.isFinite(own) && (own > 0) ) return own;
  return weapon?.system?.properties?.has?.("rch") ? 10 : 5;
}

/** What a feature's emanation on this token should look like now, or null when it should not stand. */
function featureSpec(tok, row) {
  const actor = tok.actor;
  const item = itemNamed(actor, row.item ?? row.key);
  if ( !item ) return null;
  if ( row.while && !actor.effects.some(e => e.active && (lower(e.name) === lower(row.while))) ) return null;
  const held = row.holding ? heldWeaponFor(actor, row.holding) : null;
  if ( row.holding && !held ) return null;
  const rollData = actor.getRollData();
  const act = row.activity ? activityNamed(item, row.activity) : null;
  if ( row.activity && !act ) return null;
  const range = (row.range === "weaponReach") ? weaponReachOf(held) : emanationRange(row, rollData, activitySizeOf(item, rollData, act));
  if ( !range ) return null;
  // A ring with no effect (a `pulse` row) is only the geometry the pulse reads; nobody wears it.
  if ( row.effect === null ) return { tok, actor, item, row, range, effect: null,
    disabled: !!row.incapacitated && actor.statuses?.has?.("incapacitated") };
  const effect = item.effects.find(e => lower(e.name) === lower(row.effect)) ?? null;
  if ( !effect ) return null;
  const { changes, unresolved } = resolveChanges(effect.changes.map(c => ({ key: c.key, mode: c.mode, value: c.value, priority: c.priority })), rollData);
  if ( unresolved.length ) { console.warn(`${TITLE} | ${row.key} on ${actor.name}: could not resolve ${unresolved.join(", ")} — the aura does not stand.`); return null; }
  return { tok, actor, item, row, range,
    effect: { name: effect.name, img: effect.img ?? item.img ?? null, description: row.rule, changes },
    disabled: !!row.incapacitated && actor.statuses?.has?.("incapacitated") };
}

/** Debounced AND serialized per scene: ⚠ two overlapping sweeps each raise the same ring. */
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

/** Make this scene's feature emanations true: one region per standing (token, row); spell regions only re-floored. */
async function reconcileScene(scene) {
  if ( !isActiveGM() || !scene ) return;
  const names = listed();
  const wanted = new Map();
  // ⚠ Only a LIVE scene raises a ring: a party leaves tokens on every scene it has visited.
  if ( live() && liveNow().has(scene.id) ) {
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
  const removeArea = async region => { await reconcileMembers(region, { gone: region }); if ( scene.regions.get(region.id) ) await region.delete().catch(() => {}); };
  for ( const region of scene.regions.filter(r => flagOf(r)?.kind === "feature") ) {
    const f = flagOf(region);
    const id = `${f.tokenId}|${f.key}`;
    const w = wanted.get(id);
    // Not wanted, or a second area for the same aura: lifted and deleted.
    if ( !w || seen.has(id) ) { await removeArea(region); continue; }
    seen.add(id);
    wanted.delete(id);
    const beh = behaviorOf(region);
    // The radius follows the range; a ring that DRIFTED off its token (see `standing`) is put back.
    const radius = w.range * pxPerUnit(scene);
    const shape = emanationShapeData(standing(w.tok), radius);
    const base = region.shapes?.[0]?.base;
    const drifted = !base || ["x", "y", "width", "height"].some(k => base[k] !== shape.base[k]);
    if ( (region.shapes?.[0]?.radius !== radius) || drifted ) await region.update({ shapes: [shape] });
    if ( (region.visibility !== RING_VISIBILITY()) || !region.locked ) await region.update(ringHidden());
    if ( beh ) {
      const upd = {};
      if ( beh.disabled !== w.disabled ) upd.disabled = w.disabled;
      if ( !foundry.utils.objectsEqual(beh.system.effect?.changes ?? null, w.effect?.changes ?? null) ) upd["system.effect"] = w.effect;
      if ( !foundry.utils.isEmpty(upd) ) await beh.update(upd);
    }
    await reconcileMembers(region);
  }
  for ( const w of wanted.values() ) {
    try {
      // ⚠ No dnd5e flags: the saves machine's area adoption must never see a feature's aura as an area.
      const [region] = await scene.createEmbeddedDocuments("Region", [{
        name: `${w.row.key} [${w.actor.name}]`, color: colorFor(w.row.reach),
        shapes: [emanationShapeData(standing(w.tok), w.range * pxPerUnit(scene))],
        attachment: { token: w.tok.id },
        ...ringHidden(), highlightMode: "shapes",
        flags: { [MODULE_ID]: { [FLAG]: { kind: "feature", key: w.row.key, tokenId: w.tok.id, itemUuid: w.item.uuid } } }
      }], { dnd5e: { createActivityBehaviors: false } });
      if ( !region ) { console.error(`${TITLE} | ${w.row.key} around ${w.actor.name}: the region was not created.`); continue; }
      await adoptRegion(region, { kind: "feature", key: w.row.key, tok: w.tok, itemUuid: w.item.uuid, reach: w.row.reach, effect: w.effect, disabled: w.disabled });
      await announce(w.row, w.actor, w.item, w.range, w.effect, "stands");
      await reconcileMembers(scene.regions.get(region.id) ?? region);
    } catch(err) {
      console.error(`${TITLE} | Could not raise ${w.row.key} around ${w.actor.name}.`, err);
    }
  }
  // Spell regions too: a scene going live or dead changes what they apply, and no event of theirs says so.
  for ( const region of scene.regions.filter(r => flagOf(r)?.kind === "spell") ) await reconcileMembers(region);
}

/* --- the lifecycle: a spell's emanation is the region placed at the cast --------------------- */

async function adoptSpellRegion(region) {
  try {
    if ( !isActiveGM() || !live() || flagOf(region) ) return;
    const itemUuid = region.getFlag("dnd5e", "item");
    // live only: a region names its item by uuid with no card behind it — dnd5e's own region reads resolve the same way
    const item = resolveUuid(itemUuid);
    if ( !item ) return;
    const row = rowNamed(item.name);
    if ( !row || (row.kind !== "spell") || !listed().has(lower(row.key)) ) return;
    const actor = item.actor ?? null;
    // The placement stamps the usage token as `flags.dnd5e.origin`.
    const originTok = resolveUuid(region.getFlag("dnd5e", "origin"));
    const tok = (originTok?.documentName === "Token") ? originTok
      : actor?.token ?? region.parent.tokens.find(t => t.actor && ((t.actor === actor) || (t.actor.uuid === actor?.uuid))) ?? null;
    const rollData = actor?.getRollData?.() ?? {};
    const effect = row.effect ? (item.effects.find(e => lower(e.name) === lower(row.effect)) ?? null) : null;
    const resolved = effect ? resolveChanges(effect.changes.map(c => ({ key: c.key, mode: c.mode, value: c.value, priority: c.priority })), rollData) : { changes: [], unresolved: [] };
    const spellLevel = Number(region.getFlag("dnd5e", "spellLevel") ?? item.system?.level ?? 0);
    const scaling = Math.max(0, spellLevel - Number(item.system?.level ?? 0));
    await adoptRegion(region, { kind: "spell", key: row.key, tok, itemUuid, reach: row.reach, scaling,
      effect: (effect && !resolved.unresolved.length) ? { name: effect.name, img: effect.img ?? item.img ?? null, description: row.rule, changes: resolved.changes } : null });
    const size = activitySizeOf(item, rollData);
    const drawn = region.shapes?.[0]?.radius;
    await announce(row, actor, item, size ?? (Number.isFinite(drawn) ? drawn / pxPerUnit(region.parent) : null), effect ? { name: effect.name, changes: resolved.changes } : null, "is cast",
      { activity: activityOfType(item, "save"), regionId: region.id });
    await reconcileMembers(region);
  } catch(err) {
    console.error(`${TITLE} | Could not adopt a spell's emanation — its effects apply by hand.`, err);
  }
}

/* --- the cast: an area from the caster places itself on the caster ------------------------------ */

/** A listed spell row whose activity is an emanation from the caster (a `radius` template, range self). */
function castEmanationRow(activity) {
  if ( !live() || (activity?.item?.type !== "spell") ) return null;
  const row = rowNamed(activity.item.name);
  if ( !row || (row.kind !== "spell") || !listed().has(lower(row.key)) ) return null;
  return selfAreaOf(activity) ? row : null;
}

/** An area that starts on its user: a `radius` or `emanation` template with range self, on any item. */
function selfAreaOf(activity) {
  const tpl = activity?.target?.template;
  if ( !["radius", "emanation"].includes(tpl?.type) || !(Number(tpl?.size) > 0) ) return false;
  return (activity.range?.units ?? "self") === "self";
}

/** The listed `pulse` row whose FORM this activity is, or null: its use places no area and rolls no damage. */
function transformRowOf(activity) {
  if ( !live() || !activity?.item ) return null;
  const key = pulseFormKey(EMANATIONS, { itemName: activity.item.name, activityName: activity.name }, listed());
  return key ? { key, ...EMANATIONS[key] } : null;
}

// A self-centred area is never clicked down: the placement prompt is off and the casting client
// places the Region with the data `TemplatePlacement.fromActivity` would write.
Hooks.on("dnd5e.preUseActivity", (activity, usageConfig) => {
  try {
    if ( transformRowOf(activity) ) {
      usageConfig.create ??= {};
      usageConfig.create.measuredTemplate = false;
      usageConfig.subsequentActions = false;   // the pack's damage on use: the pulse is the damage
      return;
    }
    if ( !live() || !selfAreaOf(activity) ) return;
    usageConfig.create ??= {};
    usageConfig.create.measuredTemplate = false;
  } catch(err) { console.warn(`${TITLE} | Could not switch off the template prompt.`, err); }
});

Hooks.on("dnd5e.postUseActivity", (activity, _usageConfig, results) => {
  try {
    if ( !live() || transformRowOf(activity) || !selfAreaOf(activity) ) return;
    if ( (results?.templates ?? []).flat().length ) return;   // the system placed one after all
    const actor = activity.actor;
    if ( !actor?.isOwner ) return;
    void placeSelfArea(activity, castEmanationRow(activity), results?.message instanceof ChatMessage ? results.message : null);
  } catch(err) { console.error(`${TITLE} | Could not place the area — place the template by hand.`, err); }
});

async function placeSelfArea(activity, row, message) {
  const actor = activity.actor;
  const tok = actor.token ?? activity.getUsageToken?.() ?? actor.getActiveTokens?.(true, true)?.[0] ?? null;
  const scene = tok?.parent;
  if ( !tok || !scene ) return;
  const tpl = activity.target.template;
  const units = scene.grid.units;
  // The size in the SCENE's units, as the placement converts it.
  const inScene = n => (n === "" || n === null || n === undefined) ? undefined
    : (Number(dnd5e.utils.convertLength(Number(n), tpl.units || "ft", units, { strict: false })) || Number(n));
  const size = inScene(tpl.size);
  const spellLevel = castLevelOn(message) ?? activity.getRollData?.()?.item?.level ?? activity.item.system?.level ?? null;
  await scene.createEmbeddedDocuments("Region", [{
    name: `${activity.item.name} [${game.user.name}]`, color: game.user.color,
    shapes: [emanationShapeData(standing(tok), size * pxPerUnit(scene))],
    ...(canvas?.level?.id ? { levels: [canvas.level.id] } : {}),
    restriction: { enabled: true, type: "move" },
    attachment: { token: tok.id },
    ...ringHidden(), highlightMode: "coverage",
    flags: { dnd5e: {
      activity: activity.uuid, item: activity.item.uuid, origin: tok.uuid, spellLevel,
      dimensions: { size, width: inScene(tpl.width), height: inScene(tpl.height), units }
    } }
  }], row ? { dnd5e: { createActivityBehaviors: false } } : {});
  // The type picked in the casting window goes onto the emanation card once the GM posts it.
  if ( row ) void carryDamageTypeChoice(activity);
}

/* --- the casting window: a damage type the part leaves open is picked THERE ------------------- */

// A radio per damage type on the usage dialog, the alignment's default checked; held until the cast lands.
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
    const footer = element.querySelector(SURFACES.dialogFooter);
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

// ⚠ dnd5e does NOT make a placed region a concentration dependent: the area ends here.
Hooks.on("deleteActiveEffect", effect => {
  if ( !isActiveGM() || !effect?.statuses?.has?.("concentrating") ) return;
  void endConcentrationAreas(effect);
});
/**
 * Every region stamped with the cast's activity comes down with its concentration; a cast with a
 * demand card is the saves machine's (saves/areas.js) except for this module's own rings.
 * ⚠ A re-cast's area wears the same activity uuid: the tie (`areas`) names this cast's regions, and
 * an untied area matches only while no other concentration of that activity stands.
 */
async function endConcentrationAreas(effect) {
  try {
    const activityUuid = effect.flags?.dnd5e?.activity?.uuid ?? null;
    if ( !activityUuid ) return;
    const actor = (effect.parent instanceof Actor) ? effect.parent : null;
    const tied = effect.getFlag(MODULE_ID, AREAS_FLAG);
    const another = !!actor?.effects?.some(e => (e.id !== effect.id) && e.statuses?.has?.("concentrating")
      && (e.flags?.dnd5e?.activity?.uuid === activityUuid));
    const untiedIsOurs = !Array.isArray(tied) && !another;
    const demanded = game.messages.contents.some(m => (m.system?.concentration === effect.id) && m.getFlag(MODULE_ID, "saves")?.templated);
    for ( const scene of game.scenes ) {
      for ( const region of scene.regions.filter(r => r.getFlag("dnd5e", "activity") === activityUuid) ) {
        const own = !!flagOf(region);                                   // this module's own emanation placement
        if ( demanded && !own ) continue;                               // the saves machine's cast, its sweep
        if ( !own && !untiedIsOurs && !(tied ?? []).includes(region.uuid) ) continue;
        if ( scene.regions.get(region.id) ) await region.delete().catch(() => {});
      }
    }
  } catch(err) {
    console.error(`${TITLE} | Could not end an area with its concentration — delete the area by hand.`, err);
  }
}

/** The flag on a concentration effect: the uuids of the regions its cast placed (the sweep's tie). */
const AREAS_FLAG = "areas";

// The tie, written on the casting client, which owns the concentration effect.
Hooks.on("dnd5e.postUseActivity", async (activity, _usageConfig, results) => {
  try {
    const regions = (results?.templates ?? []).flat().filter(r => r?.parent && r.uuid);
    if ( !regions.length ) return;
    const actor = activity?.actor;
    if ( !(actor instanceof Actor) || !actor.isOwner ) return;
    const concId = results?.message?.system?.concentration ?? null;
    const effect = (concId ? actor.effects.get(concId) : null)
      ?? actor.effects.filter(e => e.statuses?.has?.("concentrating") && (e.flags?.dnd5e?.activity?.uuid === activity.uuid)).at(-1)
      ?? null;
    if ( !effect ) return;
    const prior = effect.getFlag(MODULE_ID, AREAS_FLAG) ?? [];
    await effect.setFlag(MODULE_ID, AREAS_FLAG, [...new Set([...prior, ...regions.map(r => r.uuid)])]);
  } catch(err) {
    console.warn(`${TITLE} | Could not tie a cast's area to its concentration — the area may outlive the spell.`, err);
  }
});

/* --- the card (R5 / N3): an emanation says what it is when it appears ------------------------- */

const KEY_LABELS = {
  // dnd5e 6.0 moved the roll bonuses under `system.rolls.*` and shims the old keys: label both.
  "system.rolls.ability.save.bonus": v => `${Number(v) >= 0 ? "+" : ""}${v} to saving throws`,
  "system.rolls.damage.mwak.bonus": v => `+${v} to melee weapon damage`,
  "system.rolls.damage.rwak.bonus": v => `+${v} to ranged weapon damage`,
  "system.bonuses.abilities.save": v => `${Number(v) >= 0 ? "+" : ""}${v} to saving throws`,
  "system.bonuses.mwak.damage": v => `+${v} to melee weapon damage`,
  "system.bonuses.rwak.damage": v => `+${v} to ranged weapon damage`,
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
  if ( row.quiet ) return;   // a ring that follows what is held says nothing as it rises and falls
  try {
    const reach = (row.reach === "helpful") ? "allies and neutrals inside" : (row.reach === "all") ? "every creature inside" : "enemies inside";
    const pulseLine = row.pulse ? (() => {
      const { raw, type } = pulseDamageOf(item, row);
      return raw ? `every creature inside takes ${raw} (${Roll.replaceFormulaData(raw, actor?.getRollData?.() ?? {})}) ${type ?? ""} damage at the end of your turns — while ${row.while ?? "it"} stands`.replace(/\s+/g, " ") : null;
    })() : null;
    const nothing = row.remind ? "a notice at the start of your turn — the heal is yours to aim"
      : pulseLine ? pulseLine
      : (row.effect === null) ? `no effect to apply — ${row.caveat ?? "the ring is the table's"}` : reach;
    const rangeText = range ? `${range}-foot Emanation` : "Emanation";
    // A part with several types is a choice the card carries: the alignment's default, or the caster's pick.
    const types = partTypesOf(activity);
    const alignment = actor?.system?.details?.alignment ?? null;
    const choice = (types.length > 1) ? { types, activityUuid: activity.uuid, alignment, ...damageTypeFor(types, alignment) } : null;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: bfCard({
        img: item?.img ?? null, eyebrow: "Emanation", tone: (row.reach === "helpful") ? "good" : "bad",
        title: `${row.key} — ${actor?.name ?? ""} — ${rangeText}`,
        subtitle: effect ? `${reach}: ${effect.name} — ${describeChanges(effect.changes)}${row.trigger ? " · a save on entering and on ending a turn inside" : ""}${row.heal ? " · an ally at 0 HP regains Hit Points at the start of its turn" : ""}` : (row.trigger ? "a save on entering and on ending a turn inside" : nothing),
        lines: [ruleLine(row.rule), (row.caveat && (row.effect !== null)) ? `<span style="opacity:0.8;">${row.caveat}</span>` : null]
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

// The pick is a fold onto the card (R2): the GM writes it straight, a player's travels by relay.
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
  html.querySelector(SURFACES.messageContent)?.appendChild(row);
});

// Every damage roll of the cast wears the card's type, or the default when it lands before the card.
Hooks.on("dnd5e.preRollDamageV2", (config, _dialog, message) => {
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

/** Sweep the live scenes and every scene that carries an emanation: raised on the one, brought down on the others. */
const sweepEverywhere = () => {
  const scenes = liveNow();
  for ( const s of game.scenes ) if ( scenes.has(s.id) || s.regions.some(r => flagOf(r)) ) scheduleScene(s);
};
Hooks.once("ready", sweepEverywhere);
Hooks.on(`${MODULE_ID}.emanationsChanged`, sweepEverywhere);

/**
 * ⚠ No document hook carries a user's view; the signal is the scene navigation rendering (NOTES
 * *A user's VIEWED scene has no document hook*). It renders often: sweep only when the set changed.
 */
let liveKey = null;
const watchLive = () => {
  if ( !isActiveGM() ) { liveKey = null; return; }
  const key = [...liveNow().keys()].sort().join("|");
  if ( key === liveKey ) return;
  liveKey = key;
  sweepEverywhere();
};
Hooks.on("updateScene", (_scene, changes) => { if ( "active" in changes ) watchLive(); });
Hooks.on("renderSceneNavigation", watchLive);
Hooks.on("canvasReady", canvasObj => { scheduleScene(canvasObj?.scene ?? game.scenes.viewed); watchLive(); });
Hooks.on("createToken", tok => scheduleScene(tok.parent));
Hooks.on("deleteToken", tok => scheduleScene(tok.parent));
Hooks.on("updateToken", (tok, changes) => {
  if ( !isActiveGM() || !tok.parent ) return;
  // A move re-floors every emanation on the scene; a change of actor or disposition re-sweeps.
  if ( ("x" in changes) || ("y" in changes) || ("elevation" in changes) || ("_regions" in changes) ) {
    for ( const region of tok.parent.regions.filter(r => flagOf(r)) ) void reconcileMembers(region);
    // A ring's source moved: once the platform has moved the attached ring, re-base one that drifted.
    if ( (("x" in changes) || ("y" in changes)) && tok.parent.regions.some(r => (flagOf(r)?.kind === "feature") && (flagOf(r).tokenId === tok.id)) ) {
      setTimeout(() => scheduleScene(tok.parent), 1000);
    }
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
  void reconcileMembers(region, { gone: region });
  // A feature's aura deleted by hand stands again: its switch is the setting or the list, not the region.
  if ( f.kind === "feature" ) scheduleScene(region.parent);
});
for ( const hook of ["createItem", "deleteItem", "updateItem"] ) {
  Hooks.on(hook, item => { if ( item?.parent instanceof Actor ) for ( const s of scenesWith(item.parent) ) scheduleScene(s); });
}
Hooks.on("updateActor", (actor, changes) => {
  if ( ("system" in changes) || ("items" in changes) ) for ( const s of scenesWith(actor) ) scheduleScene(s);
});
for ( const hook of ["createActiveEffect", "deleteActiveEffect", "updateActiveEffect"] ) {
  Hooks.on(hook, effect => {
    const actor = (effect?.parent instanceof Actor) ? effect.parent : effect?.parent?.parent;
    if ( !(actor instanceof Actor) || effect.getFlag?.(MODULE_ID, FLAG) ) return;   // never re-sweep on our own member effects
    for ( const s of scenesWith(actor) ) scheduleScene(s);
  });
}
