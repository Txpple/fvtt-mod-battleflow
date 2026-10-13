/**
 * By the Books — MACHINE (ARCHITECTURE.md §7): SUMMONS (issue #1) — the player casts and places, the
 * active GM's client makes the creature. dnd5e's summon activity places only for a user who holds
 * Create Token (and Create Actor for a compendium import) in a world with Allow Summoning on, and its
 * dialog cannot ask what a spell's own text asks (the dragon's damage type). Here the system's placement
 * is switched off, and its dialog's Creation section hidden, for every summon activity with a profile;
 * the caster's client asks everything in ONE popup off the cast card (the form rows ruled C, RULINGS
 * *Summons*; the shared gallery and the spot picker are gallery.js; the creature type and size when
 * the activity offers more than one), takes the spaces (the range ring, the clicks; no permission
 * needed) and writes the record on its own card; the elect
 * fetches or imports the creature with its own permissions, applies dnd5e's own profile changes, narrows
 * the dragon's breath, creates the tokens, seats them right
 * after the caster, grants the caster's players ownership, lands the shared resistance on the caster, and
 * stamps `applied`. With no GM online the card holds and says so (DESIGN §4). Dismiss deletes what the
 * elect made, and the concentration effect's end asks it.
 */
import { MODULE_ID, readFlag, TITLE, activeCombatFor, isActiveGM, queueFlagWrite, answersHere, statContext } from "./core.js";
import { cardActivity, lower, resolveUuid } from "./lookup.js";
import { COMPANIONS, SUMMON_CHOICES, SUMMON_LIGHTS, SUMMON_LOOKS, summonChoiceEntries, summonOwnInitiativeEntries, summonSingleEntries, listedNames } from "./decide/registry.js";
import { profileRows, choiceRowKey, formNeeds, poolPicks, summonRecord, placedAnswer, narrowedActivities, resistanceEffectData,
  ownershipGrant, seatInitiative, rangeFeet, replacedSummons, companionEffectName, currentCompanion, companionMenu, companionAsk,
  carriedItemIds, sizesInOrder, castOptions, summonEffectName, tokenLight } from "./decide/summons.js";
import { bfCard, esc, popupKey } from "./decide/present.js";
import { artChanges } from "./decide/summon-art.js";
import { concentrationIdOf } from "./decide/card.js";
import { effectRecord, joinEffectReceipt } from "./decide/receipt.js";
import { describeCreature, openPicker, pickSpots, poolFromPacks, poolRuleOf, summonArt } from "./gallery.js";
import { askConcentrationEnd, CONCENTRATION_ASKED } from "./shared.js";
import { momentButton, registerResumable, shownMoments } from "./ui.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const SUMMON_FLAG = "summon";
const listed = () => listedNames(summonChoiceEntries());

/** A summon activity the module takes off the system's hands: one with a profile the cast may use. */
const takes = activity => (activity?.type === "summon") && !!activity.availableProfiles?.length;

/** The SUMMON_LIGHTS row a spell answers to, by name, or null. */
const lightRowOf = name => Object.entries(SUMMON_LIGHTS).find(([k]) => lower(k) === lower(name ?? ""))?.[1] ?? null;

/** The SUMMON_LOOKS row a creature answers to, by name, or null. */
const lookOf = name => Object.entries(SUMMON_LOOKS).find(([k]) => lower(k) === lower(name ?? ""))?.[1] ?? null;

/** The activity on the actor's own item (a use's hook hands over the clone dnd5e works on). */
const liveActivity = activity => activity?.actor?.items?.get(activity.item?.id)?.system?.activities?.get(activity.id) ?? null;

/** The summon activity on an item the module takes, or null. */
const summonActivityOf = item => [...(item?.system?.activities ?? [])].find(a => takes(a)) ?? null;

/**
 * The casts this client is making from the summon menu, by activity uuid: the menu's answer, read when
 * the use posts its card. Present only while that one use runs.
 */
const planned = new Map();

/* --- straight to the menu: no activity picker, no usage dialog ------------------------------------- */

// ⚠ dnd5e calls no hook before its activity picker (`Item5e#use`): an item with a summon activity (Dancing
// Lights' Move Lights, Minor Illusion's Study, Flaming Sphere's ram save) skips it for the summon, the
// picker dismissed unseen (gear-lights.js does the same). The other activities stay on the sheet and the
// placed creature's own (RULINGS *Summons*: every summon goes straight to the module's menu).
listen("renderActivityChoiceDialog", "summons", (app, element) => {
  try {
    const activity = summonActivityOf(app?.item);
    if ( !activity ) return;
    if ( element?.style ) element.style.display = "none";
    setTimeout(() => { void app.close({ animate: false }); }, 0);
    void activity.use();
  } catch(err) { console.error(`${TITLE} | Could not open the summon — use the spell's summon from the sheet.`, err); }
});

// The use of a summon activity opens the module's menu instead (the form, the creature, its type and size,
// the spell's own question, the slot), and the cast happens on Place, after the spaces are picked: a
// cancelled menu spends nothing. A companion standing opens its own menu (COMPANIONS). The cast the menu
// makes runs with no dialog and the system's placement off.
listen("dnd5e.preUseActivity", "summons", (activity, usageConfig, dialogConfig) => {
  try {
    if ( !takes(activity) ) return;
    // The usage dialog's Creation section (Place Summons, the system's own selects) is hidden as well as
    // switched off: ticked, it would start dnd5e's placement beside the module's (RULINGS *Summons*).
    usageConfig.create ??= {};
    usageConfig.create.summons = false;
    if ( dialogConfig ) {
      dialogConfig.options ??= {};
      dialogConfig.options.display ??= {};
      foundry.utils.setProperty(dialogConfig.options.display, "create.summons", false);
    }
    if ( planned.has(activity.uuid) ) {
      if ( dialogConfig ) dialogConfig.configure = false;
      return;
    }
    const row = companionOf(activity.item?.name);
    if ( row ) {
      const through = castThrough.delete(activity.uuid);
      // With no GM online the cast is refused before anything, so no slot is spent on a creature that cannot land.
      if ( needsGM(row) ) return false;
      const id = through ? null : currentCompanion(summonRecords(), activity.actor?.uuid ?? "", activity.item.name);
      const message = id ? game.messages.get(id) : null;
      if ( message ) { void showCompanionMenu(message, activity); return false; }
    }
    if ( !activity.actor?.isOwner ) return;
    const live = liveActivity(activity) ?? activity;
    void openCastMenu(live).catch(err => {
      console.error(`${TITLE} | The summon menu failed — cast the spell again.`, err);
      ui.notifications?.error(`${TITLE}: the summon menu could not open (${err?.message ?? err}).`);
    });
    return false;
  } catch(err) { console.warn(`${TITLE} | Could not take the summon — the spell is cast as usual.`, err); }
});

/* --- the record on the cast card ------------------------------------------------------------------ */

/** A form row's label, art and lines, read off the creature it names (a compendium read, no permission). */
async function describeProfile(row) {
  if ( !row.uuid ) return { ...row, label: row.name || `a creature of CR ${row.cr ?? "?"}${row.types.length ? ` (${row.types.join(", ")})` : ""}`, img: null, summary: null };
  return { ...row, ...(await describeCreature(row.uuid, { label: row.name || "" })) };
}

/** The sizes the activity offers, smallest first (the system's own order). */
const sizesOf = activity => sizesInOrder([...(activity.creatureSizes ?? [])], Object.keys(CONFIG.DND5E?.actorSizes ?? {}));

/** What the record and the menu share, read off the activity at a level. */
async function castFacts(activity, level) {
  const actor = activity.actor;
  const tok = actor.token ?? activity.getUsageToken?.() ?? actor.getActiveTokens?.(true, true)?.[0] ?? null;
  return {
    sourceUuid: actor.uuid, sourceName: tok?.name ?? actor.name,
    itemUuid: activity.item.uuid, itemName: activity.item.name, activityUuid: activity.uuid,
    level, profiles: await Promise.all(profileRows(activity.profiles.map(p => p.toObject?.() ?? p), level).map(describeProfile)),
    choice: choiceRowKey(SUMMON_CHOICES, activity.item.name, listed()),
    sceneId: tok?.parent?.id ?? canvas.scene?.id ?? null,
    mode: activity.summon?.mode ?? null, creatureTypes: [...(activity.creatureTypes ?? [])],
    creatureSizes: sizesOf(activity), rangeFt: rangeFeet(activity.range)
  };
}

async function stampRecord(activity, message, answer) {
  const actor = activity.actor;
  const facts = await castFacts(activity, activity.relevantLevel);
  const record = summonRecord({ ...facts, concentrationId: concentrationIdOf(message) });
  // a companion standing: the new form takes its place (its square, or the pocket)
  const was = companionOf(activity.item.name) ? currentCompanion(summonRecords(), actor.uuid, activity.item.name) : null;
  if ( was && game.messages.get(was) ) record.replaces = replacesOf(game.messages.get(was));
  record.askedBy = game.user.id;   // the caster's own screen answers: a GM casting for a player's character included
  if ( lightRowOf(activity.item.name) ) record.light = activity.item.name;
  // the menu answered before the cast: the record is placed at birth (a profile gone at the cast level keeps it asked)
  const patch = answer ? placedAnswer(record, answer, SUMMON_CHOICES) : null;
  await message.setFlag(MODULE_ID, SUMMON_FLAG, { ...record, ...(patch ?? {}), ...statContext(actor.uuid) });
}

listen("dnd5e.postUseActivity", "summons", (activity, _usageConfig, results) => {
  try {
    if ( !takes(activity) || !activity.actor?.isOwner ) return;
    const answer = planned.get(activity.uuid) ?? null;
    // Light or Continual Flame on a token: token-lights.js lands it; the spell's earlier object goes (one at a time).
    if ( answer?.lightOn === "token" ) { dismissSingles(activity.actor.uuid, activity.item.name, null); return; }
    const message = (results?.message instanceof ChatMessage) ? results.message : null;
    if ( !message ) return;
    void stampRecord(activity, message, answer).catch(err => console.error(`${TITLE} | Could not stamp the summon on the card — place the creature by hand.`, err));
  } catch(err) {
    console.error(`${TITLE} | The summon could not be recorded — place the creature by hand.`, err);
  }
});

/** Dismiss the caster's standing summons of a SUMMON_SINGLES spell, all but `keep` (a message id). */
function dismissSingles(sourceUuid, itemName, keep) {
  const ids = replacedSummons(summonRecords(), { id: keep ?? "", sourceUuid, itemName }, listedNames(summonSingleEntries()));
  for ( const id of ids ) {
    const earlier = game.messages.get(id);
    if ( earlier ) void askDismiss(earlier).catch(err => console.warn(`${TITLE} | Could not dismiss the earlier summon — delete its token by hand.`, err));
  }
  return ids;
}

/* --- the one menu: the form, the choice, the pool, the slot, then the placement ------------------- */

/** The caster's token document on the record's scene, for the preview's origin and elevation. */
function casterToken(flag) {
  const actor = resolveUuid(flag.sourceUuid);
  const scene = game.scenes.get(flag.sceneId) ?? canvas.scene;
  return actor?.token ?? scene?.tokens?.find(t => t.actor?.uuid === flag.sourceUuid) ?? actor?.getActiveTokens?.(true, true)?.[0] ?? null;
}

/** The count a profile's formula makes at this cast (a roll when it is dice), on the caster's roll data. */
async function countOf(flag, profile) {
  const formula = String(profile.count || "1");
  if ( Number.isNumeric?.(formula) ) return Math.max(1, parseInt(formula, 10));
  try {
    const roll = await new Roll(formula, resolveUuid(flag.sourceUuid)?.getRollData?.() ?? {}).evaluate();
    return Math.max(1, parseInt(roll.total, 10) || 1);
  } catch { return 1; }
}

/** Whether the use spends a slot the menu must pick: a leveled spell, not off a scroll. */
const spendsSlot = activity => !!activity.requiresSpellSlot && (activity.consumption?.spellSlot !== false)
  && (Number(activity.item?.system?.level) > 0) && !activity.item?.getFlag?.("dnd5e", "spellLevel");

/** How a spell may be cast (the slots with one left, the ritual), as the system's own slot rules read them. */
function castOptionsOf(activity) {
  const item = activity.item;
  const method = CONFIG.DND5E?.spellcasting?.[item.system?.method];
  const exclusiveSlots = type => !!CONFIG.DND5E?.spellcasting?.[type]?.exclusive?.slots;
  const slots = Object.entries(activity.actor.system?.spells ?? {}).map(([key, s]) => ({ key, level: Number(s.level) || 0, value: Number(s.value) || 0,
    max: Number(s.max) || 0, type: s.type ?? null, label: s.label ?? "" }));
  return castOptions(slots, { level: Number(item.system?.level) || 0, ritual: !!item.system?.properties?.has?.("ritual"), spendsSlot: spendsSlot(activity),
    allowed: s => !(method?.exclusive?.spells && (item.system.method !== s.type)) && !(exclusiveSlots(s.type) && (item.system.method !== s.type)) });
}

/**
 * The menu, described to the shared picker. `facts` the record's facts (or the record itself, off a card);
 * `cast` the slot options; `light` the SUMMON_LIGHTS row. `onAnswer` gets the answer once the spaces are
 * picked (the light on a token picks none).
 */
async function askSummon(key, facts, { cast = [], light = null } = {}, onAnswer) {
  const caster = resolveUuid(facts.sourceUuid);
  if ( !caster ) return;
  const types = facts.creatureTypes ?? [];
  const sizes = facts.creatureSizes ?? [];
  // a light's object asks no size: one 5-ft square (`light.size`), whatever the spell allows (RULINGS *Summons*)
  const needs = formNeeds({ profiles: facts.profiles, choice: facts.choice, mode: facts.mode, creatureTypes: types, creatureSizes: light ? [] : sizes });
  const poolProfile = facts.profiles.find(p => poolPicks(p, facts.mode)) ?? null;
  // the table's own token art over the compendium's (the Summon Art window), on the rows and the ghost alike
  const tokenArt = (name, img) => summonArt(facts.itemName, name).token ?? img ?? null;
  const pool = ((needs.pool && poolProfile) ? await poolFromPacks(poolRuleOf(poolProfile)) : []).map(r => ({ ...r, img: tokenArt(r.name, r.img) }));
  const choiceRow = needs.choice ? SUMMON_CHOICES[facts.choice] : null;
  // a light's object reads as the thing touched (a stone), in the table's art when it sets one
  const labelOf = p => light ? light.object.name : (p.label || p.name);
  const imgOf = p => light ? (tokenArt(p.label || p.name, null) ?? light.object.img) : tokenArt(p.label || p.name, p.img);
  const profileRow = (p, checked) => ({ value: p.id, label: labelOf(p), img: imgOf(p), summary: light ? null : p.summary, checked });
  const targets = [...(game.user.targets ?? [])].filter(t => t.actor);
  const sections = [];
  if ( light ) sections.push({ head: "Where the light goes", field: "bf-light-on", pills: [
    // no token targeted: the token way is greyed out (target one, then cast again)
    { value: "token", label: targets.length ? `On ${targets.map(t => t.name).join(", ")}` : "On a token (target one first)", checked: targets.length > 0, locked: !targets.length },
    { value: "object", label: `On an object: ${light.object.name}`, checked: !targets.length }] });
  if ( needs.profile ) sections.push({ head: "The form", field: "bf-summon-profile", rows: facts.profiles.map((p, i) => profileRow(p, i === 0)) });
  else if ( (facts.profiles.length === 1) && !needs.pool ) sections.push({ field: "bf-summon-profile", rows: [profileRow(facts.profiles[0], true)] });
  if ( needs.pool ) sections.push({ field: "bf-summon-pick", pool });
  if ( needs.type ) sections.push({ head: "Its creature type", field: "bf-summon-type", pills: types.map(t => ({ value: t, label: CONFIG.DND5E?.creatureTypes?.[t]?.label ?? t })) });
  if ( needs.size ) sections.push({ head: "Its size", field: "bf-summon-size", pills: sizes.map(s => ({ value: s, label: CONFIG.DND5E?.actorSizes?.[s]?.label ?? s })) });
  if ( choiceRow ) {
    sections.push({ head: choiceRow.ask, field: "bf-summon-choice", pills: choiceRow.options.map(o => ({ value: o, label: CONFIG.DND5E?.damageTypes?.[o]?.label ?? o })) });
    sections.push({ rule: choiceRow.rule });
  }
  if ( cast.length > 1 ) sections.push({ head: "Cast with", field: "bf-summon-slot", pills: cast.map((o, i) => ({ value: o.value, label: o.label, checked: i === 0 })) });
  const replacing = facts.replaces ?? null;
  if ( replacing ) sections.push({ note: (replacing.state === "pocket") ? "The new form waits in the pocket dimension, as the old one did." : "The new form takes the old one's place." });
  // what must be picked, in the order the popup reads (the creature, its type and size, the spell's own question)
  const asked = [
    needs.pool ? { field: "bf-summon-pick", why: "pick the creature first" } : null,
    needs.type ? { field: "bf-summon-type", why: "pick its creature type first" } : null,
    needs.size ? { field: "bf-summon-size", why: "pick its size first" } : null,
    choiceRow ? { field: "bf-summon-choice", why: `pick ${lower(choiceRow.ask)} first` } : null
  ].filter(Boolean);
  // the light's token way needs a token targeted (the pill is greyed without one; this is the belt)
  const validate = light ? picks => ((picks.one("bf-light-on") === "token") && !game.user.targets?.size) ? "target the token first, then press Place" : null : null;
  await openPicker({ id: key }, SUMMON_FLAG, caster, {
    title: `${facts.itemName} — ${facts.sourceName}`, icon: "fa-solid fa-spaghetti-monster-flying", width: 480, by: facts.askedBy ?? game.user.id,
    card: { eyebrow: light ? "Light" : "Summon", title: facts.itemName, subtitle: facts.level ? `level ${facts.level}` : "" },
    sections, needs: asked, validate,
    buttons: [
      { action: "place", label: "Place", default: true, checks: true, submit: picks => {
        const profile = facts.profiles.find(p => p.id === picks.one("bf-summon-profile")) ?? facts.profiles[0];
        const pickRow = pool.find(r => r.uuid === picks.one("bf-summon-pick")) ?? null;
        const creatureType = picks.one("bf-summon-type");
        const creatureSize = picks.one("bf-summon-size");
        const slot = cast.find(o => o.value === picks.one("bf-summon-slot")) ?? cast[0] ?? null;
        const lightOn = light ? (picks.one("bf-light-on") ?? "object") : null;
        void (async () => {
          try {
            if ( lightOn === "token" ) { await onAnswer({ lightOn, slot }); return; }
            const count = await countOf(facts, profile);
            const usePool = poolPicks(profile, facts.mode);
            const inPlace = (replacing?.state === "present") && replacing.placement;
            const intoPocket = replacing?.state === "pocket";
            const placements = inPlace ? [replacing.placement] : intoPocket ? [{ x: 0, y: 0, elevation: 0, rotation: 0 }] : await pickSpots({ originToken: casterToken(facts), actorUuid: usePool ? pickRow.uuid : profile.uuid, count,
              rangeFt: facts.rangeFt ?? null, label: usePool ? pickRow.name : labelOf(profile),
              img: usePool ? pickRow.img : imgOf(profile) });
            if ( !placements.length ) return;   // cancelled on the map: nothing cast
            await onAnswer({ profileId: profile.id, pick: pickRow ? { uuid: pickRow.uuid, name: pickRow.name, img: pickRow.img } : null,
              choice: picks.one("bf-summon-choice"), placements, count, intoPocket, slot, lightOn,
              sceneId: (inPlace ? replacing.placement.sceneId : null) ?? canvas.scene?.id ?? facts.sceneId ?? null,
              creatureSize: light ? (sizes.includes(light.size) ? light.size : (sizes[0] ?? null)) : needs.size ? creatureSize : (sizes[0] ?? null), creatureType: needs.type ? creatureType : (types[0] ?? null) });
          } catch(err) {
            console.error(`${TITLE} | The summon could not be placed — place the creature by hand.`, err);
            ui.notifications?.error(`${TITLE}: the summon could not be placed (${err?.message ?? err}).`);
          }
        })();
      } },
      { action: "cancel", label: "Not now" }
    ]
  });
}

/**
 * The menu before the cast, on the caster's client: the Concentration question first (dnd5e's dialog,
 * which asked it, is skipped), then the menu; Place picks the spaces and THEN casts, the answer riding
 * the use to its card. Nothing is spent until the spaces are picked.
 */
async function openCastMenu(activity) {
  const item = activity.item;
  const cast = castOptionsOf(activity);
  if ( spendsSlot(activity) && !cast.length ) {
    ui.notifications?.warn(`${TITLE}: no spell slot left to cast ${item.name}.`);
    return;
  }
  const concentration = await askConcentrationEnd(activity);
  if ( !concentration.go ) return;
  const facts = await castFacts(activity, Number(item.system?.level) || activity.relevantLevel);
  const was = companionOf(item.name) ? currentCompanion(summonRecords(), activity.actor.uuid, item.name) : null;
  if ( was && game.messages.get(was) ) facts.replaces = replacesOf(game.messages.get(was));
  facts.askedBy = game.user.id;
  await askSummon(`cast-${activity.uuid}`, facts, { cast, light: lightRowOf(item.name) }, async answer => {
    const usage = { create: { summons: false }, [MODULE_ID]: { [CONCENTRATION_ASKED]: true, lightOn: answer.lightOn ?? null } };
    if ( answer.slot?.ritual ) usage.consume = { spellSlot: false };
    else if ( answer.slot ) usage.spell = { slot: answer.slot.value };
    if ( concentration.end ) usage.concentration = { begin: true, end: concentration.end };
    planned.set(activity.uuid, answer);
    try { await activity.use(usage, { configure: false }, {}); } finally { planned.delete(activity.uuid); }
  });
}

/** The card's own popup, for a record still `asked` (a cast from before the menu, or a profile the cast level dropped). */
async function showSummonPopup(message) {
  const flag = readFlag(message, SUMMON_FLAG);
  if ( flag?.status !== "asked" ) return;
  await askSummon(message.id, flag, { light: flag.light ? lightRowOf(flag.light) : null }, answer => answerPlacement(message, flag, answer));
}

async function answerPlacement(message, flag, answer) {
  const patch = placedAnswer(flag, answer, SUMMON_CHOICES);
  if ( !patch ) { ui.notifications?.warn(`${TITLE}: the summon's answer was not one the spell allows.`); return; }
  await queueFlagWrite(message, SUMMON_FLAG, current => {
    if ( current.status !== "asked" ) return false;
    Object.assign(current, patch);
  });
}

/* --- the elect lands it ---------------------------------------------------------------------------- */

/** The caster's token on a scene, or null. */
const casterTokenOn = (caster, scene) => scene?.tokens?.find(t => t.actor?.uuid === caster?.uuid || t.actorId === caster?.id) ?? null;

/**
 * A summoned token shown like the rest of the table: the caster's nameplate and bar visibility (always,
 * when the caster has no token here), and its Hit Points on the first bar.
 */
function tableLook(casterTok, data) {
  const ALWAYS = CONST.TOKEN_DISPLAY_MODES.ALWAYS;
  return {
    displayName: casterTok?.displayName ?? ALWAYS,
    displayBars: casterTok?.displayBars ?? ALWAYS,
    bar1: { ...(data.bar1 ?? {}), attribute: data.bar1?.attribute || "attributes.hp" }
  };
}

/** The concentration effect the cast opened on the caster, or null. */
const concentrationOf = (caster, flag) => flag.concentrationId ? (caster?.effects?.get(flag.concentrationId) ?? null) : null;

/** The item on the summoned creature a row narrows, and its update with the parts narrowed to the type. */
function narrowingUpdate(actor, row, type) {
  const item = row?.narrow ? [...(actor.items ?? [])].find(i => lower(i.name) === lower(row.narrow)) ?? null : null;
  if ( !item ) return null;
  const parts = narrowedActivities(item.toObject().system?.activities ?? {}, type);
  return parts ? { _id: item.id, ...parts } : null;
}

async function landSummon(message) {
  let claimed = false;
  await queueFlagWrite(message, SUMMON_FLAG, current => {
    if ( (current.status !== "placed") || current.applied || current.applying ) return false;
    current.applying = true;
    claimed = true;
  });
  if ( !claimed ) return;
  const flag = readFlag(message, SUMMON_FLAG);
  const landed = [];
  let outcome = "landed";
  let failure = null;
  let resistance = null;
  let replaced = [];
  let companion = null;
  let standing = null;
  const events = [];
  try {
    const caster = resolveUuid(flag.sourceUuid);
    const activity = cardActivity(message, flag.activityUuid);
    if ( !(caster instanceof Actor) || !activity ) throw new Error("the cast's activity could not be read off the card");
    const profile = activity.profiles.find(p => p._id === flag.profileId);
    if ( !profile ) throw new Error(`no profile ${flag.profileId} on ${activity.item?.name}`);
    const scene = game.scenes.get(flag.sceneId) ?? canvas.scene;
    if ( !scene ) throw new Error("the scene the creature was placed on is gone");
    const fetchOptions = { folderId: caster.folder?.id ?? null, origin: { key: "flags.dnd5e.summon.origin", value: activity.item.uuid } };
    const actor = await dnd5e.documents.Actor5e.fetchExisting(flag.summonUuid, fetchOptions);
    const options = { profile: profile._id, creatureSize: flag.creatureSize ?? undefined, creatureType: flag.creatureType ?? undefined };
    const row = flag.choice ? SUMMON_CHOICES[flag.choice] : null;
    const concentration = concentrationOf(caster, flag);
    const tokensData = [];
    const creatureName = flag.summonName || actor.name;
    // the table's own art (the Summon Art window), read now: a creature landed earlier keeps what it had
    const art = artChanges(summonArt(flag.itemName, creatureName));
    // a light's object (SUMMON_LIGHTS): the thing touched, named and drawn so, carrying the spell's light
    const lightRow = flag.light ? lightRowOf(flag.light) : null;
    const look = lookOf(creatureName);
    for ( const placement of flag.placements ?? [] ) {
      // dnd5e's own changes for the profile, per token (a formula may be dice).
      const changes = await activity.getChanges(actor, profile, options);
      if ( lightRow ) {
        foundry.utils.mergeObject(changes.tokenUpdates, { name: lightRow.object.name, light: tokenLight(lightRow),
          texture: { src: lightRow.object.img }, ring: { enabled: false } });
        changes.actorUpdates.name = lightRow.object.name;
        changes.actorUpdates.img = lightRow.object.img;
      }
      if ( look?.light ) foundry.utils.mergeObject(changes.tokenUpdates, { light: tokenLight(look.light) });
      if ( Number.isFinite(look?.alpha) ) changes.tokenUpdates.alpha = look.alpha;
      // `seen`: the creature's Invisible condition switched off on this token (its delta), the base actor untouched
      if ( look?.seen ) {
        changes.actorUpdates.effects ??= [];
        for ( const e of actor.effects.filter(x => x.statuses?.has?.("invisible") && !x.disabled) ) {
          const have = changes.actorUpdates.effects.find(x => x._id === e.id);
          if ( have ) have.disabled = true;
          else changes.actorUpdates.effects.push({ ...e.toObject(), disabled: true });
        }
      }
      foundry.utils.mergeObject(changes.tokenUpdates, art.tokenUpdates);
      Object.assign(changes.actorUpdates, art.actorUpdates);
      const narrowed = (row && flag.picked) ? narrowingUpdate(actor, row, flag.picked) : null;
      if ( narrowed ) {
        // ⚠ A token delta's item entry is merged as nested data; a dotted key would be stored as a literal key.
        const nested = foundry.utils.expandObject(narrowed);
        const have = changes.actorUpdates.items.find(i => i._id === narrowed._id);
        if ( have ) foundry.utils.mergeObject(have, nested); else changes.actorUpdates.items.push(nested);
      }
      const data = await activity.getTokenData({ actor, placement: { ...placement }, tokenUpdates: changes.tokenUpdates, actorUpdates: changes.actorUpdates });
      // shown like the table: the caster's nameplate and bar visibility, the HP bar
      Object.assign(data, tableLook(casterTokenOn(caster, scene), data));
      tokensData.push(data);
    }
    // a new form for a companion waiting in the pocket waits there too: the token is kept, not drawn
    const created = flag.intoPocket ? [] : await scene.createEmbeddedDocuments("Token", tokensData, { dnd5e: { autoRollNPCHP: "no" } });
    for ( const t of created ) landed.push({ tokenId: t.id, sceneId: scene.id, tokenUuid: t.uuid, actorUuid: t.actor?.uuid ?? null, name: t.name });
    Hooks.callAll("dnd5e.postSummon", activity, profile, created, options);
    // The caster's players own what they summoned.
    const grant = ownershipGrant(caster.ownership ?? {}, actor.ownership ?? {});
    if ( grant ) await actor.update({ ownership: { ...(actor._source?.ownership ?? {}), ...grant } });
    // The seat, two ways (SUMMON_OWN_INITIATIVE): right after the caster on the caster's Initiative, or,
    // for a row there (the familiar), it joins and rolls its own.
    const combat = activeCombatFor(caster);
    if ( combat ) {
      const own = listedNames(summonOwnInitiativeEntries()).has(lower(flag.itemName));
      const initiative = own ? null : seatInitiative(combat.getCombatantsByActor(caster)[0]?.initiative ?? null);
      const seated = await combat.createEmbeddedDocuments("Combatant", created.map(t => ({ tokenId: t.id, sceneId: scene.id, actorId: t.actorId, initiative })));
      if ( own && seated.length ) await combat.rollInitiative(seated.map(c => c.id));
    }
    // The shared resistance on the caster, for the spell's life.
    if ( row?.resist && flag.picked ) {
      const label = CONFIG.DND5E?.damageTypes?.[flag.picked]?.label ?? flag.picked;
      const data = resistanceEffectData({ type: flag.picked, name: `${row.resist} (${label})`, img: activity.item.img, origin: activity.item.uuid, description: row.says ?? "" });
      data.duration = concentration ? { ...(concentration._source?.duration ?? {}) } : (activity.duration?.getEffectData?.() ?? {});
      if ( concentration ) foundry.utils.setProperty(data, "flags.dnd5e.dependentOn", concentration.uuid);
      const [effect] = await caster.createEmbeddedDocuments("ActiveEffect", [data]);
      if ( effect ) resistance = { uuid: caster.uuid, name: caster.name, img: caster.img ?? null, effectId: effect.id, effectName: effect.name, effectImg: effect.img ?? null, description: data.description };
    }
    // A companion: the effect on its owner for as long as it stands, and its stat block (what it carries is the rest).
    const crow = companionOf(flag.itemName);
    if ( crow ) {
      const name = flag.summonName || actor.name;
      const type = flag.creatureType ? (CONFIG.DND5E?.creatureTypes?.[flag.creatureType]?.label ?? flag.creatureType) : null;
      const pocket = !!flag.intoPocket;
      const snapshot = pocket ? foundry.utils.deepClone(tokensData[0] ?? null) : null;
      if ( snapshot ) delete snapshot._id;
      await endCompanionEffects(caster, message.id);   // a landing makes exactly one
      const [effect] = await caster.createEmbeddedDocuments("ActiveEffect", [{
        name: companionEffectName({ noun: crow.noun, name, type, pocket }), img: tokensData[0]?.texture?.src ?? actor.img,
        type: "base", transfer: false, disabled: false, origin: activity.item.uuid, description: crow.says ?? "",
        flags: { [MODULE_ID]: { companion: message.id } }
      }]);
      companion = { noun: crow.noun, name, type, state: pocket ? "pocket" : "present", effectId: effect?.id ?? null,
        baseItems: actor.items.contents.map(i => i.id), snapshot, events: [] };
      // its arrival floats over its owner (the landing's own moment plays the FX, so it is not a companion beat)
      if ( !pocket && created.length ) events.push(ownerEvent("appear", created[0], caster, companionEffectName({ noun: crow.noun, name, type })));
    }
    // Without Concentration, the summon stands on an effect of its caster's: removing it dismisses the summon
    // (the user). A Concentration summon needs none: Concentration's end dismisses it.
    else if ( !concentration && created.length ) {
      const name = summonEffectName({ itemName: flag.itemName, creatureName: lightRow ? lightRow.object.name : creatureName });
      const [effect] = await caster.createEmbeddedDocuments("ActiveEffect", [{
        name, img: activity.item.img ?? tokensData[0]?.texture?.src ?? actor.img,
        type: "base", transfer: false, disabled: false, origin: activity.item.uuid,
        description: `<p>${esc(flag.itemName)} stands while this effect does: remove it to dismiss ${created.length > 1 ? "them" : "it"}.</p>`,
        duration: activity.duration?.getEffectData?.() ?? {},
        flags: { [MODULE_ID]: { summonEffect: message.id } }
      }]);
      if ( effect ) {
        standing = { effectId: effect.id, name };
        events.push(ownerEvent("appear", created[0], caster, name));
      }
    }
    // One at a time (SUMMON_SINGLES): the caster's earlier familiar goes as the new one lands.
    replaced = replacedSummons(game.messages.contents.map(m => ({ id: m.id, flag: readFlag(m, SUMMON_FLAG) })),
      { id: message.id, sourceUuid: flag.sourceUuid, itemName: flag.itemName }, listedNames(summonSingleEntries()));
  } catch(err) {
    console.error(`${TITLE} | The summon could not be landed — place the creature by hand.`, err);
    outcome = "failed";
    failure = String(err?.message ?? err);
  } finally {
    await queueFlagWrite(message, SUMMON_FLAG, current => {
      current.applied = true; current.applying = false; current.outcome = outcome;
      current.landed = landed;
      if ( failure ) current.failure = failure;
      if ( resistance ) current.resistance = { effectId: resistance.effectId, effectName: resistance.effectName };
      if ( replaced.length ) current.replaced = replaced.length;
      if ( companion ) current.companion = companion;
      if ( standing ) current.standing = standing;
      if ( events.length ) current.events = [...(current.events ?? []), ...events];
    });
    for ( const id of replaced ) {
      const earlier = game.messages.get(id);
      if ( earlier ) void askDismiss(earlier).catch(err => console.warn(`${TITLE} | Could not dismiss the earlier summon — delete its token by hand.`, err));
    }
    if ( resistance ) await queueFlagWrite(message, "effectReceipt", current => {
      joinEffectReceipt(current, { uuid: resistance.uuid, name: resistance.name, img: resistance.img,
        effects: [effectRecord({ id: resistance.effectId, name: resistance.effectName, img: resistance.effectImg, description: resistance.description }, statContext(flag.sourceUuid ?? null))] });
    });
  }
}

/** Dismiss: the elect deletes what it made; concentration's dependents go with the effect, the rest by hand here. */
async function dismissSummon(message) {
  let claimed = false;
  await queueFlagWrite(message, SUMMON_FLAG, current => {
    if ( !current.applied || !current.dismissAsked || current.dismissed || current.dismissing ) return false;
    current.dismissing = true;
    claimed = true;
  });
  if ( !claimed ) return;
  const flag = readFlag(message, SUMMON_FLAG);
  try {
    const caster = resolveUuid(flag.sourceUuid);
    const doc = flag.companion ? liveToken(flag) : null;
    if ( doc ) {
      await dropCarried(doc, flag.companion.baseItems);
      await queueFlagWrite(message, SUMMON_FLAG, current => { current.companion.events = [...(current.companion.events ?? []), companionEvent("leave", doc, flag.companion, caster)]; });
      await pause(LEAVE_MS);
    } else if ( flag.standing ) {
      const at = liveToken(flag);
      if ( at ) await queueFlagWrite(message, SUMMON_FLAG, current => { current.events = [...(current.events ?? []), ownerEvent("leave", at, caster, flag.standing.name)]; });
    }
    const byScene = new Map();
    for ( const l of flag.landed ?? [] ) byScene.set(l.sceneId, [...(byScene.get(l.sceneId) ?? []), l.tokenId]);
    for ( const [sceneId, ids] of byScene ) {
      const scene = game.scenes.get(sceneId);
      const live = ids.filter(id => scene?.tokens.get(id));
      if ( live.length ) await scene.deleteEmbeddedDocuments("Token", live);
    }
    const effect = flag.resistance?.effectId ? caster?.effects?.get(flag.resistance.effectId) : null;
    if ( effect ) await effect.delete();
    if ( flag.companion ) await endCompanionEffects(caster, message.id);
    const held = flag.standing?.effectId ? caster?.effects?.get(flag.standing.effectId) : null;
    if ( held ) await held.delete({ [MODULE_ID]: { summonEnd: true } });
  } catch(err) {
    console.error(`${TITLE} | The summon could not be dismissed — delete the token by hand.`, err);
  } finally {
    await queueFlagWrite(message, SUMMON_FLAG, current => {
      current.dismissed = true; current.dismissing = false; current.dismissedAt = Date.now();
      if ( current.companion ) { current.companion.state = "gone"; current.companion.snapshot = null; }
    });
  }
}

registerResumable(SUMMON_FLAG, {
  pending: flag => (flag?.status === "placed") && ((!flag.applied && !flag.applying) || (flag.applied && flag.dismissAsked && !flag.dismissed && !flag.dismissing)
    || (flag.applied && !flag.dismissAsked && !!flag.companion?.ask && !flag.companion.acting)),
  drives: () => isActiveGM(),
  drive: async message => {
    const flag = readFlag(message, SUMMON_FLAG);
    if ( !flag?.applied ) await landSummon(message);
    else if ( flag.dismissAsked ) await dismissSummon(message);
    else await actCompanion(message);
  }
});

/** The caster (on their own card) or a GM asks for the dismissal; the elect executes it. */
async function askDismiss(message) {
  await queueFlagWrite(message, SUMMON_FLAG, current => {
    if ( !current.applied || current.dismissAsked ) return false;
    current.dismissAsked = true;
  });
}

// Concentration's end ends the summon. ⚠ dnd5e tracks dependents on effects, activities, items and actors,
// never on a token, and its summon activity ties nothing to the concentration effect: the elect asks the
// dismissal of every landed record that names the effect (the resistance cascades on its own).
listen("deleteActiveEffect", "summons", effect => {
  try {
    if ( !isActiveGM() || !(effect?.parent instanceof Actor) || !effect.statuses?.has?.("concentrating") ) return;
    const casterUuid = effect.parent.uuid;
    for ( const message of game.messages.contents ) {
      const f = readFlag(message, SUMMON_FLAG);
      if ( !f?.applied || f.dismissAsked || (f.concentrationId !== effect.id) || (f.sourceUuid !== casterUuid) ) continue;
      void askDismiss(message).catch(err => console.warn(`${TITLE} | Could not dismiss the summon with its concentration — delete the token by hand.`, err));
    }
  } catch(err) { console.warn(`${TITLE} | Could not end the summon with its concentration — delete the token by hand.`, err); }
});

// The standing effect of a summon without Concentration, removed (by its owner or a GM, or its clock),
// dismisses the summon; the elect asks it. The elect's own removal, a dismissal, carries `summonEnd`.
listen("deleteActiveEffect", "summons", (effect, options) => {
  try {
    const id = readFlag(effect, "summonEffect");
    if ( !id || !isActiveGM() || options?.[MODULE_ID]?.summonEnd ) return;
    const message = game.messages.get(id);
    const f = message ? readFlag(message, SUMMON_FLAG) : null;
    if ( !f?.applied || f.dismissAsked || (f.standing?.effectId !== effect.id) ) return;
    void askDismiss(message).catch(err => console.warn(`${TITLE} | Could not dismiss the summon with its effect — delete the token by hand.`, err));
  } catch(err) { console.warn(`${TITLE} | Could not end the summon with its effect — delete the token by hand.`, err); }
});

/* --- companions: a summon that stays (COMPANIONS, RULINGS *Summons*) ---------------------------- */

/** The COMPANIONS row a spell answers to, by name, or null. */
const companionOf = name => Object.entries(COMPANIONS).find(([k]) => lower(k) === lower(name ?? ""))?.[1] ?? null;

/** Every card's summon record, by message id. */
const summonRecords = () => game.messages.contents.map(m => ({ id: m.id, flag: readFlag(m, SUMMON_FLAG) }));

/** The live token a record landed, or null (in the pocket, dismissed, deleted by hand). */
function liveToken(flag) {
  for ( const l of flag?.landed ?? [] ) {
    const doc = game.scenes.get(l.sceneId)?.tokens?.get(l.tokenId);
    if ( doc ) return doc;
  }
  return null;
}

/** A token document's centre on its scene. */
const centreOfDoc = doc => doc.getCenterPoint?.() ?? { x: doc.x + (doc.width * doc.parent.grid.sizeX / 2), y: doc.y + (doc.height * doc.parent.grid.sizeY / 2) };

/** What a new cast replaces: the standing companion's message, where it is, and its square on the table. */
function replacesOf(message) {
  const flag = readFlag(message, SUMMON_FLAG);
  const doc = liveToken(flag);
  return { id: message.id, state: flag?.companion?.state ?? "present",
    placement: doc ? { x: doc.x, y: doc.y, elevation: doc.elevation ?? 0, rotation: doc.rotation ?? 0, level: doc.level ?? null, sceneId: doc.parent.id } : null };
}

/** The activity uuids whose next use is the cast menu's "Summon": the cast goes on, once. */
const castThrough = new Set();

/** The no-GM refusal: a companion is made and unmade by the GM's client. */
const needsGM = row => {
  if ( game.users.activeGM ) return false;
  ui.notifications?.error(`${TITLE}: you can't summon or dismiss a ${lower(row.noun)} without a GM online.`);
  return true;
};

/** A player's ask of the standing companion, written on its card for the elect. */
async function askCompanion(message, ask) {
  await queueFlagWrite(message, SUMMON_FLAG, current => {
    const patch = companionAsk(current.companion, ask);
    if ( !patch ) return false;
    Object.assign(current.companion, patch);
  });
}

const MENU = {
  away: { label: "Put it away", hint: "into its pocket dimension" },
  recall: { label: "Call it back", hint: "an unoccupied space within reach" },
  dismiss: { label: "Dismiss forever", hint: "" },
  summon: { label: "Summon", hint: "cast the spell: a new form takes its place" }
};

/** The cast menu: the companion as it stands, and what can be done with it (the choices by its state). */
async function showCompanionMenu(message, activity) {
  const flag = readFlag(message, SUMMON_FLAG);
  const row = companionOf(flag?.itemName);
  const caster = resolveUuid(flag?.sourceUuid);
  if ( !flag?.companion || !row || !caster ) return;
  const state = flag.companion.state;
  const creature = await describeCreature(flag.summonUuid, { label: flag.companion.name || flag.summonName });
  // the art it wears, on the table or in the pocket, over the compendium's
  creature.img = liveToken(flag)?.texture?.src ?? flag.companion.snapshot?.texture?.src ?? creature.img;
  const where = (state === "pocket") ? "in its pocket dimension" : "on the table";
  const act = {
    away: () => askCompanion(message, { kind: "away" }),
    recall: async () => {
      const origin = caster.getActiveTokens?.(false, true)?.find(t => t.parent?.id === canvas.scene?.id) ?? null;
      const [placement] = await pickSpots({ originToken: origin, actorUuid: flag.summonUuid, count: 1, rangeFt: row.recallFt ?? null,
        label: flag.companion.name || flag.summonName, seen: false, img: flag.companion.snapshot?.texture?.src ?? null });
      if ( placement ) await askCompanion(message, { kind: "recall", placement: { ...placement, sceneId: canvas.scene?.id ?? null } });
    },
    dismiss: () => askDismiss(message),
    summon: () => { castThrough.add(activity.uuid); return activity.use(); }
  };
  await openPicker(message, "companionMenu", caster, {
    title: `${flag.itemName} — ${flag.sourceName}`, icon: "fa-solid fa-spaghetti-monster-flying", width: 440, by: game.user.id,
    card: { eyebrow: row.noun, title: creature.label, subtitle: [flag.companion.type, where].filter(Boolean).join(" · ") },
    sections: [{ rows: [{ value: flag.summonUuid, ...creature }] }, { note: row.brief ?? "" }],
    buttons: [
      ...companionMenu(state, row).map((kind, i) => ({ action: kind, label: MENU[kind].label, default: i === 0,
        submit: () => { if ( !needsGM(row) ) void Promise.resolve(act[kind]()).catch(err => console.error(`${TITLE} | The ${lower(row.noun)} could not ${kind}.`, err)); } })),
      { action: "cancel", label: "Not now" }
    ]
  });
}

/**
 * What it carried goes as it leaves the table (into the pocket, dismissed, at 0 HP): a Loot Shelf chest
 * where it stood when Loot Shelf is active (`createLootContainer`, ephemeral: gone once emptied), else
 * lost (RULINGS *Summons*). Loot Shelf is detected, never required.
 */
async function dropCarried(doc, baseItems) {
  const actor = doc?.actor;
  if ( !actor ) return [];
  const ids = carriedItemIds(actor.items.contents.map(i => ({ id: i.id, type: i.type })), baseItems ?? []);
  if ( !ids.length ) return [];
  const shelf = game.modules.get("fvtt-mod-lootshelf");
  if ( shelf?.active && shelf.api?.createLootContainer ) {
    try {
      const items = ids.map(id => actor.items.get(id)?.toObject()).filter(Boolean);
      const chest = await shelf.api.createLootContainer({ name: `${doc.name}'s gear`, img: items[0]?.img ?? undefined, items, ephemeral: true });
      const token = await chest.getTokenDocument({ x: doc.x, y: doc.y, elevation: doc.elevation ?? 0 });
      await doc.parent.createEmbeddedDocuments("Token", [token.toObject()]);
    } catch(err) { console.warn(`${TITLE} | Loot Shelf could not take what it carried — the items are lost.`, err); }
  }
  await actor.deleteEmbeddedDocuments("Item", ids);
  return ids;
}

/**
 * A summon's arrive or leave beat, floated over its OWNER under the effect's name ("+(Familiar: Raven
 * (Fey))" over the caster, never "+(Raven)" over the familiar; RULINGS *Summons*). `x`/`y` and `tokenUuid`
 * stay the creature's, where the FX plays.
 */
const ownerEvent = (kind, doc, owner, label) => {
  const c = centreOfDoc(doc);
  return { id: foundry.utils.randomID(8), kind, label, ownerUuid: owner?.uuid ?? null, x: c.x, y: c.y, sceneId: doc.parent.id, tokenUuid: doc.uuid };
};

/** A companion's beat, on its record (each client floats it; the moment gate publishes it): `name` the creature. */
const companionEvent = (kind, doc, companion, owner) => ({
  ...ownerEvent(kind, doc, owner, companionEffectName({ noun: companion.noun, name: companion.name, type: companion.type })), name: companion.name
});

/** Long enough for the leave picture to play over the token before it goes. */
const LEAVE_MS = 900;
const pause = ms => new Promise(resolve => { setTimeout(resolve, ms); });

/** Every effect on the owner that names this card's companion (the recorded one, and any stray copy). */
const companionEffectsOf = (caster, messageId) => (caster?.effects?.contents ?? []).filter(e => readFlag(e, "companion") === messageId);

/** Remove them, as the elect: the owner's removal prompt lets this pass. */
async function endCompanionEffects(caster, messageId) {
  const ids = companionEffectsOf(caster, messageId).map(e => e.id);
  if ( ids.length ) await caster.deleteEmbeddedDocuments("ActiveEffect", ids, { [MODULE_ID]: { companionEnd: true } });
}

/** The owner's effect for a companion, renamed to where it is. */
async function renameCompanionEffect(caster, companion, pocket) {
  const effect = companion?.effectId ? caster?.effects?.get(companion.effectId) : null;
  if ( effect ) await effect.update({ name: companionEffectName({ noun: companion.noun, name: companion.name, type: companion.type, pocket }) });
}

/** The elect answers a companion ask: into the pocket (the token kept as a snapshot) or back from it. */
async function actCompanion(message) {
  let claimed = false;
  await queueFlagWrite(message, SUMMON_FLAG, current => {
    if ( !current.companion?.ask || current.companion.acting ) return false;
    current.companion.acting = true;
    claimed = true;
  });
  if ( !claimed ) return;
  const flag = readFlag(message, SUMMON_FLAG);
  const companion = flag.companion;
  const caster = resolveUuid(flag.sourceUuid);
  const patch = { ask: null, acting: false };
  try {
    if ( companion.ask.kind === "away" ) {
      const doc = liveToken(flag);
      if ( doc ) {
        await dropCarried(doc, companion.baseItems);
        const snapshot = doc.toObject();
        delete snapshot._id;
        await queueFlagWrite(message, SUMMON_FLAG, current => { current.companion.events = [...(current.companion.events ?? []), companionEvent("leave", doc, companion, caster)]; });
        await pause(LEAVE_MS);
        await doc.delete();
        patch.snapshot = snapshot;
      }
      patch.state = "pocket";
      await renameCompanionEffect(caster, companion, true);
    } else if ( companion.ask.kind === "recall" ) {
      const at = companion.ask.placement;
      const scene = game.scenes.get(at.sceneId);
      if ( !scene || !companion.snapshot ) throw new Error("nothing to call back, or the scene is gone");
      const [doc] = await scene.createEmbeddedDocuments("Token", [{ ...companion.snapshot, x: at.x, y: at.y, elevation: at.elevation ?? 0 }]);
      patch.state = "present";
      patch.snapshot = null;
      patch.events = [...(companion.events ?? []), companionEvent("appear", doc, companion, caster)];
      await queueFlagWrite(message, SUMMON_FLAG, current => {
        current.landed = [{ tokenId: doc.id, sceneId: scene.id, tokenUuid: doc.uuid, actorUuid: doc.actor?.uuid ?? null, name: doc.name }];
      });
      await renameCompanionEffect(caster, companion, false);
      const combat = activeCombatFor(caster);
      if ( combat ) {
        const own = listedNames(summonOwnInitiativeEntries()).has(lower(flag.itemName));
        const seated = await combat.createEmbeddedDocuments("Combatant", [{ tokenId: doc.id, sceneId: scene.id, actorId: doc.actorId,
          initiative: own ? null : seatInitiative(combat.getCombatantsByActor(caster)[0]?.initiative ?? null) }]);
        if ( own && seated.length ) await combat.rollInitiative(seated.map(c => c.id));
      }
    }
  } catch(err) {
    console.error(`${TITLE} | The ${lower(companion.noun)} could not ${companion.ask.kind === "away" ? "go to its pocket" : "come back"}.`, err);
    ui.notifications?.error(`${TITLE}: the ${lower(companion.noun)} could not ${companion.ask.kind === "away" ? "go to its pocket" : "come back"} (${err?.message ?? err}).`);
  } finally {
    await queueFlagWrite(message, SUMMON_FLAG, current => { Object.assign(current.companion, patch); });
  }
}

// Removing the companion's effect asks first: yes dismisses it forever; the pocket is the spell's menu.
// The elect's own removal (a dismissal) carries `companionEnd` and passes.
listen("preDeleteActiveEffect", "summons", (effect, options, userId) => {
  try {
    const id = readFlag(effect, "companion");
    if ( !id || options?.[MODULE_ID]?.companionEnd ) return;
    const message = game.messages.get(id) ?? null;
    const flag = message ? readFlag(message, SUMMON_FLAG) : null;
    const standing = !!flag?.applied && !flag.dismissAsked && !flag.dismissed && (flag.companion?.state !== "gone") && (flag.companion?.effectId === effect.id);
    if ( !standing ) return;   // an orphan, or a companion already gone: removed as usual
    if ( userId === game.user.id ) void confirmCompanionEnd(effect, message);
    return false;
  } catch(err) { console.warn(`${TITLE} | Could not read the companion's effect — it is removed as usual.`, err); }
});

async function confirmCompanionEnd(effect, message) {
  const flag = message ? readFlag(message, SUMMON_FLAG) : null;
  const row = companionOf(flag?.itemName);
  const noun = lower(row?.noun ?? "companion");
  const yes = await foundry.applications.api.DialogV2.confirm({
    window: { title: `Dismiss ${noun}?` },
    content: `<p>Dismiss ${noun}? This will remove them forever.</p><p>More options available by pressing ${flag?.itemName ? `${esc(flag.itemName)} spell` : "the spell"}.</p>`,
    rejectClose: false
  });
  if ( !yes ) return;
  if ( !message || !flag?.applied ) { await effect.delete({ [MODULE_ID]: { companionEnd: true } }); return; }
  if ( row && needsGM(row) ) return;
  await askDismiss(message);
}

// At 0 HP the familiar disappears (the spell's own text), leaving behind what it carried: the elect
// dismisses it, which drops the gear, plays the leave and ends the owner's effect.
listen("updateActor", "summons", (actor, changes) => {
  try {
    if ( !isActiveGM() || !actor?.isToken || !foundry.utils.hasProperty(changes, "system.attributes.hp.value") ) return;
    if ( Number(actor.system?.attributes?.hp?.value) > 0 ) return;
    const tokenUuid = actor.token?.uuid;
    const hit = summonRecords().find(({ flag }) => (flag?.companion?.state === "present") && !flag.dismissAsked && (flag.landed ?? []).some(l => l.tokenUuid === tokenUuid));
    const message = hit ? game.messages.get(hit.id) : null;
    if ( !message ) return;
    void (async () => {
      await queueFlagWrite(message, SUMMON_FLAG, current => { if ( current.companion ) current.companion.fell = true; });
      await askDismiss(message);
    })().catch(err => console.warn(`${TITLE} | Could not take the companion off the table at 0 HP.`, err));
  } catch(err) { console.warn(`${TITLE} | Could not read the companion's Hit Points.`, err); }
});

/** Every beat a record carries: the landing's and the standing effect's, then a companion's own. */
const beatsOf = flag => [...(flag?.events ?? []), ...(flag?.companion?.events ?? [])];

// The beats float on every client, the effect's own way and over the effect's bearer: "+(Familiar: Owl (Fey))"
// rising over the caster as it appears, "−(…)" falling as it leaves (Foundry's own float for an effect, which
// a marker effect with no change never draws). An owner with no token here floats it where the creature is.
const floated = new Set();
listen("updateChatMessage", "summons", message => {
  try {
    for ( const e of beatsOf(readFlag(message, SUMMON_FLAG)) ) {
      if ( floated.has(e.id) ) continue;
      floated.add(e.id);
      if ( (e.sceneId !== canvas.scene?.id) || !canvas?.interface?.createScrollingText ) continue;
      const on = e.kind === "appear";
      const text = `${on ? "+" : "−"}(${e.label ?? e.name})`;
      const owner = e.ownerUuid ? resolveUuid(e.ownerUuid) : null;
      const tokens = (owner?.getActiveTokens?.(true) ?? []).filter(t => t.visible && !t.document?.isSecret);
      const at = tokens.length ? tokens.map(t => ({ point: t.center, h: t.h })) : [{ point: { x: e.x, y: e.y }, h: canvas.grid.size }];
      for ( const { point, h } of at ) canvas.interface.createScrollingText(point, text, {
        anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
        direction: on ? CONST.TEXT_ANCHOR_POINTS.TOP : CONST.TEXT_ANCHOR_POINTS.BOTTOM,
        distance: 2 * h, fontSize: 28, stroke: 0x000000, strokeThickness: 4, jitter: 0.25
      });
    }
  } catch(err) { console.warn(`${TITLE} | The summon's float could not draw.`, err); }
});
listen("ready", "summons", () => {
  // what stood before this client loaded has already floated
  for ( const { flag } of summonRecords() ) for ( const e of beatsOf(flag) ) floated.add(e.id);
});

/* --- the card says it (R5) --------------------------------------------------------------------------- */

function drawSummon(message, html, flag) {
  const row = document.createElement("div");
  row.className = "bythebooks-summon";
  const caster = resolveUuid(flag.sourceUuid);
  const mine = answersHere(flag.askedBy, caster);
  if ( flag.status === "asked" ) {
    if ( !mine ) return;
    const shownKey = popupKey(message.id, SUMMON_FLAG);
    if ( !shownMoments.has(shownKey) ) { shownMoments.add(shownKey); void showSummonPopup(message); }
    row.appendChild(momentButton("Place the creature", () => { void showSummonPopup(message); }, { margin: "0.25rem 0 0" }));
    html.querySelector(SURFACES.messageContent)?.appendChild(row);
    return;
  }
  const names = (flag.landed ?? []).map(l => l.name);
  const what = `${flag.count > 1 ? `${flag.count} × ` : ""}${flag.summonName || flag.profileName || "the creature"}`;
  if ( !flag.applied ) {
    const gm = !!game.users.activeGM;
    row.innerHTML = bfCard({ eyebrow: "Summon", tone: "pending", title: `${what} — placed`,
      subtitle: gm ? "appearing…" : "no GM online — it appears when a GM connects" });
  } else if ( flag.dismissed ) {
    row.innerHTML = bfCard({ eyebrow: "Summon", tone: "neutral", title: `${what} — ${flag.companion?.fell ? "dropped to 0 HP and disappeared" : "dismissed"}`, subtitle: flag.resistance ? `${flag.resistance.effectName} ended` : "" });
  } else if ( flag.outcome === "failed" ) {
    row.innerHTML = bfCard({ eyebrow: "Summon", tone: "bad", title: `${what} — could not be landed`, subtitle: `${flag.failure ?? "see the console"} · place it by hand` });
  } else {
    const kind = flag.creatureType ? (CONFIG.DND5E?.creatureTypes?.[flag.creatureType]?.label ?? flag.creatureType) : null;
    row.innerHTML = bfCard({ eyebrow: "Summon", tone: "good", title: `${names.join(", ") || what} — summoned`,
      subtitle: [kind, flag.picked, flag.resistance ? `${flag.resistance.effectName} on ${flag.sourceName}` : null,
        (flag.companion?.state === "pocket") ? "in its pocket dimension" : null,
        flag.replaced ? "the earlier one is dismissed" : null].filter(Boolean).join(" · ") });
    if ( (mine || game.user.isGM) && !flag.dismissAsked ) row.appendChild(momentButton("Dismiss", () => { void askDismiss(message); }, { margin: "0.25rem 0 0" }));
    else if ( flag.dismissAsked ) row.appendChild(Object.assign(document.createElement("em"), { textContent: "dismissing…" }));
  }
  html.querySelector(SURFACES.messageContent)?.appendChild(row);
}

listen("dnd5e.renderChatMessage", "summons", (message, html) => {
  try {
    const flag = readFlag(message, SUMMON_FLAG);
    if ( flag ) drawSummon(message, html, flag);
  } catch(err) {
    console.error(`${TITLE} | The summon's row could not be drawn.`, err);
  }
});

listen("ready", "summons", () => {
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = Object.assign(mod.api ?? {}, { summons: { showSummonPopup, askDismiss } });
});
