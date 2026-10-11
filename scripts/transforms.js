/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): TRANSFORMS (issue #2) — Wild Shape and the polymorph
 * spells. dnd5e's transform activity opens the whole compendium browser at the use, transforms from a
 * card button only for a user who holds Create Actor in a world with Allow Transformation on, models no
 * Known Forms, and ends no form. Here a listed activity (TRANSFORMS) keeps the system's own use — the
 * dialog, the consumption, the card — but its chooser is switched off; the owner's client asks the form
 * in ONE popup off the card (the shared gallery, gallery.js, the rows ruled C), filtered to the rule's
 * pool and, for Wild Shape, to the four Known Forms on the item (an open slot learned at the use); the
 * elect transforms with dnd5e's own `transformInto` and the activity's own preset, lands a clocked form
 * effect (Revert on its fold), and reverts when the rules say — the hours, Concentration's end,
 * Incapacitated, 0 Hit Points, the Temporary Hit Points gone. The Long Rest offers the one known-form
 * swap through the mastery record's road (RULINGS *Wild Shape and the polymorph spells*).
 */
import { MODULE_ID, TITLE, isActiveGM, queueFlagWrite, canAnswerFor, statContext } from "./core.js";
import { cardActivity, lower, resolveUuid, featureNamed } from "./lookup.js";
import { TRANSFORMS, transformEntries, listedNames, tableIndex } from "./decide/registry.js";
import { poolRuleOf, capOfTarget, knownSlotsOf, knownHolderOf, knownState, learnedList, restKnownList, transformRecord,
  pickedAnswer, formEffectData, endOfForm, lockedLine, formTitle, articleOf } from "./decide/transforms.js";
import { galleryRows, crLabel } from "./decide/gallery.js";
import { bfCard, esc, popupKey, ruleLine } from "./decide/present.js";
import { targetsOf } from "./decide/card.js";
import { formRowHTML, poolFromPacks, poolListHTML, poolRight, summaryOf, wireGallerySearch } from "./gallery.js";
import { isPartyMember } from "./shared.js";
import { openMomentPopup, momentButton, registerRelay, registerResumable, shownMoments, acknowledgeMoment, momentAcknowledged } from "./ui.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const TRANSFORM_FLAG = "transform";
const FORM_SWAP_FLAG = "formSwap";
const FORM_FLAG = "form";
const KNOWN_FORMS_FLAG = "knownForms";
const LAST_FORM_FLAG = "lastForm";
/** The profile id the system is handed in place of the real one, so its chooser never opens. */
const NO_PROFILE = "battleflow";
const { rowFor } = tableIndex(TRANSFORMS);
const listed = () => listedNames(transformEntries());

/** The listed row a transform activity answers to — `cr` or `uuid` mode; a `form` activity stays the system's. */
function rowOf(activity) {
  if ( (activity?.type !== "transform") || (activity.transform?.mode === "form") ) return null;
  const row = rowFor(activity.item);
  return (row && listed().has(lower(row.key))) ? row : null;
}

/* --- the intercept: the system's chooser is switched off -------------------------------------- */

/** The real profile per use, stashed while the system is handed the sentinel. */
const stashed = new WeakMap();

listen("dnd5e.preUseActivity", "transforms", (activity, usageConfig) => {
  try {
    if ( !rowOf(activity) ) return;
    stashed.set(usageConfig, usageConfig.transform?.profile ?? activity.availableProfiles?.[0]?._id ?? null);
  } catch(err) { console.warn(`${TITLE} | Could not read the transform's profile.`, err); }
});

// After the dialog (its profile select has spoken) and before the message: the sentinel in, the pick kept.
listen("dnd5e.preActivityConsumption", "transforms", (activity, usageConfig) => {
  try {
    if ( !rowOf(activity) ) return;
    if ( usageConfig.transform?.profile && (usageConfig.transform.profile !== NO_PROFILE) ) stashed.set(usageConfig, usageConfig.transform.profile);
    usageConfig.transform ??= {};
    usageConfig.transform.profile = NO_PROFILE;
  } catch(err) { console.warn(`${TITLE} | Could not switch the system's form chooser off.`, err); }
});

/* --- the record on the use's card ------------------------------------------------------------ */

/** The Known Forms list on the holder item, as plain rows. */
const knownOf = item => [...(item?.getFlag?.(MODULE_ID, KNOWN_FORMS_FLAG) ?? [])].map(k => ({ uuid: k.uuid, name: k.name ?? "", img: k.img ?? null }));

/** The item that holds a row's Known Forms on this actor (Circle Forms spends Wild Shape's), or null. */
function knownHolderItem(actor, key) {
  const holder = knownHolderOf(TRANSFORMS, key);
  return holder ? featureNamed(actor, holder) : null;
}

/** A profile's cap evaluated on the activity's own roll data (a formula on the sheet's levels). */
function capOf(activity, profile) {
  const raw = String(profile?.cr ?? "").trim();
  if ( !raw ) return null;
  try {
    const n = Number(globalThis.dnd5e?.utils?.simplifyBonus?.(raw, activity.getRollData?.({ deterministic: true }) ?? {}));
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

/** The cap a blank profile takes from a target: its CR, else its level. */
function capFromTarget(target) {
  const actor = resolveUuid(target?.uuid);
  return capOfTarget({ cr: actor?.system?.details?.cr ?? null, level: actor?.system?.details?.level ?? null });
}

/** The owner's token on the scene, for the card's name and the record's scene. */
function tokenOf(actor, activity) {
  return actor?.token ?? activity?.getUsageToken?.() ?? actor?.getActiveTokens?.(true, true)?.[0] ?? null;
}

async function stampRecord(activity, usageConfig, message, row) {
  const actor = activity.actor;
  const tok = tokenOf(actor, activity);
  const profileId = stashed.get(usageConfig) ?? null;
  const profile = activity.profiles.find(p => p._id === profileId) ?? activity.availableProfiles?.[0] ?? activity.profiles[0] ?? null;
  const self = row.self === true;
  const snapshot = targetsOf(message).map(t => ({ uuid: t.uuid, name: t.name }));
  const targets = self ? [{ uuid: actor.uuid, name: tok?.name ?? actor.name }] : snapshot;
  if ( !targets.length ) {
    ui.notifications?.warn(`${TITLE}: ${activity.item.name} transforms the creatures you target — target them, then use it again.`);
    return;
  }
  const holder = knownHolderItem(actor, row.key);
  const known = holder ? knownOf(holder) : [];
  const record = transformRecord({
    key: row.key, sourceUuid: actor.uuid, sourceName: tok?.name ?? actor.name,
    itemUuid: activity.item.uuid, itemName: activity.item.name, itemType: activity.item.type, activityUuid: activity.uuid,
    profile: profile ? { id: profile._id, cr: capOf(activity, profile), types: [...(profile.types ?? [])], sizes: [...(profile.sizes ?? [])],
      movement: [...(profile.movement ?? [])], uuid: profile.uuid || null, name: profile.name ?? "" } : null,
    self, targets, targetCap: self ? null : capFromTarget(targets[0]),
    known, slots: knownSlotsOf(TRANSFORMS, row.key), lastForm: holder?.getFlag?.(MODULE_ID, LAST_FORM_FLAG) ?? null,
    concentrationId: message.system?.concentration || null, sceneId: tok?.parent?.id ?? canvas.scene?.id ?? null
  });
  await message.setFlag(MODULE_ID, TRANSFORM_FLAG, { ...record, ...statContext(actor.uuid) });
}

listen("dnd5e.postUseActivity", "transforms", (activity, usageConfig, results) => {
  try {
    const row = rowOf(activity);
    if ( !row || !activity.actor?.isOwner ) return;
    const message = (results?.message instanceof ChatMessage) ? results.message : null;
    if ( !message ) return;
    void stampRecord(activity, usageConfig, message, row).catch(err => console.error(`${TITLE} | The transform could not be recorded — transform by hand.`, err));
  } catch(err) {
    console.error(`${TITLE} | The transform could not be recorded — transform by hand.`, err);
  }
});

/* --- the one popup: the known forms, then the pool ------------------------------------------- */

/** A known form as a gallery row, read off the pool when the pack still ships it. */
const poolRowFor = (pool, k) => pool.find(r => r.uuid === k.uuid) ?? pool.find(r => lower(r.name) === lower(k.name)) ?? null;

/** A row's stat lines, read off the creature it names (a compendium read, no permission). */
async function describeRow(row) {
  const out = { label: row.name ?? "", img: row.img ?? null, summary: summaryOf(null) };
  try {
    const actor = await fromUuid(row.uuid);
    if ( actor ) { out.img = actor.prototypeToken?.texture?.src ?? actor.img ?? out.img; out.summary = summaryOf(actor); }
  } catch { /* the row keeps its name */ }
  return out;
}

/** The cap as the card says it: "CR ¼ or lower" (null for an open pool). */
const capLabelOf = rule => (rule?.crMax === null || rule?.crMax === undefined) ? "" : `CR ${crLabel(rule.crMax)} or lower`;

/**
 * The gallery's HTML for a record: the Known Forms (each described, the last one marked) and the pool
 * — open under a known-forms list with a slot free (the pick learns into it) or with no list at all;
 * locked behind a line and a link when the list is full (RULINGS *Wild Shape and the polymorph spells*).
 */
async function galleryHTML(flag, pool, { field, gm = false }) {
  const rule = poolRuleOf(flag.profile ?? {}, { targetCap: flag.targetCap });
  const allowed = galleryRows(pool, rule);
  const known = flag.known ?? [];
  const slots = Number(flag.slots) || 0;
  const lines = [];
  const knownRows = [];
  for ( const k of known ) {
    const row = poolRowFor(pool, k);
    const described = await describeRow(row ?? { uuid: k.uuid, name: k.name, img: k.img });
    const overCap = row ? !allowed.some(a => a.uuid === row.uuid) : false;
    const right = (row ? poolRight(row) : "") + ((k.uuid === flag.lastForm) ? "<br>last used" : "") + (overCap ? "<br>above your cap" : "");
    knownRows.push({ uuid: k.uuid, html: formRowHTML(described, { field: overCap ? "bf-form-locked" : field, value: k.uuid, checked: (k.uuid === flag.lastForm) && !overCap, right }) });
  }
  const state = knownState({ known, slots });
  if ( slots > 0 ) {
    lines.push(`<div><b>Your known forms</b> · ${known.length} of ${slots} · one swap per Long Rest</div>${knownRows.map(r => r.html).join("")}`
      + (state.open ? `<div style="opacity:0.75;font-size:var(--font-size-11,11px);margin:0.2rem 0;">${state.open} slot${state.open === 1 ? "" : "s"} open — a form picked from the pool below is learned into one at this use.</div>` : ""));
  }
  const rest = allowed.filter(r => !known.some(k => k.uuid === r.uuid));
  const capLabel = capLabelOf(rule);
  const open = gm || !(slots > 0) || (state.state === "open");
  if ( open ) {
    lines.push(poolListHTML(rest, { field, head: (slots > 0) ? "Fill the open slot from the pool" : "The form" }));
  } else {
    lines.push(`<details style="margin-top:0.4rem;"><summary style="cursor:pointer;opacity:0.8;">${esc(lockedLine({ more: rest.length, capLabel }))} · <span style="color:rgb(222,120,40);">show them</span></summary>${poolListHTML(rest, { field: "bf-form-locked", head: "The pool" })}</details>`);
  }
  return { html: lines.join(""), rule, allowed, capLabel };
}

/** The pool for a record: every visible pack's creatures of the profile's types, uncapped (the known forms are matched in it). */
const poolFor = flag => poolFromPacks({ types: flag.profile?.types?.length ? flag.profile.types : null });

async function answerPick(message, flag, pick, { learn = false } = {}) {
  const patch = pickedAnswer(flag, { pick, learn });
  if ( !patch ) { ui.notifications?.warn(`${TITLE}: that form is not one of your known forms.`); return false; }
  await queueFlagWrite(message, TRANSFORM_FLAG, current => {
    if ( current.status !== "asked" ) return false;
    Object.assign(current, patch);
  });
  return true;
}

/** The pick read off the popup's form: the row's uuid, name and art from the pool. */
function pickFrom(form, pool, field) {
  const uuid = form.querySelector(`input[name="${field}"]:checked`)?.value ?? null;
  if ( !uuid ) return null;
  const row = pool.find(r => r.uuid === uuid);
  return row ? { uuid: row.uuid, name: row.name, img: row.img ?? null } : { uuid, name: form.querySelector(`input[name="${field}"]:checked`)?.closest("[data-bf-form]")?.querySelector("b")?.textContent ?? "", img: null };
}

async function showFormPopup(message) {
  const flag = message.getFlag(MODULE_ID, TRANSFORM_FLAG);
  if ( flag?.status !== "asked" ) return;
  const user = resolveUuid(flag.sourceUuid);
  if ( !user ) return;
  const pool = await poolFor(flag);
  const { html, capLabel } = await galleryHTML(flag, pool, { field: "bf-form-pick" });
  const row = TRANSFORMS[flag.key];
  const who = flag.self ? "you" : flag.targets.map(t => t.name).join(", ");
  const dialog = await openMomentPopup(message, TRANSFORM_FLAG, user, {
    title: `${flag.itemName} — ${flag.sourceName}`, icon: "fa-solid fa-paw", width: 500,
    content: bfCard({
      eyebrow: "Transform", tone: "pending", title: flag.itemName,
      subtitle: [capLabel, flag.self ? null : `on ${who}`, "the GM's client transforms"].filter(Boolean).join(" · "),
      lines: [html, row?.rule ? ruleLine(row.rule) : null]
    }),
    buttons: [
      { action: "become", label: flag.self ? "Become the form" : "Transform", default: true, callback: (_event, button) => {
        const pick = pickFrom(button.form, pool, "bf-form-pick");
        if ( !pick ) { ui.notifications?.warn(`${TITLE}: answer first — pick a form.`); void showFormPopup(message); return; }
        const learn = !(flag.known ?? []).some(k => k.uuid === pick.uuid);
        void answerPick(message, flag, pick, { learn }).then(ok => { if ( !ok ) void showFormPopup(message); });
      } },
      { action: "cancel", label: "Not now" }
    ]
  });
  lockRows(dialog?.element ?? null);
  wireGallerySearch(dialog?.element ?? null);
}

/** The locked rows cannot be picked: their radios are disabled once the dialog stands. */
function lockRows(root) {
  for ( const input of root?.querySelectorAll?.('input[name="bf-form-locked"]') ?? [] ) {
    input.disabled = true;
    const row = input.closest("[data-bf-form]");
    if ( row ) row.style.opacity = "0.45";
  }
}

/** The GM's change of a landed form (RULINGS: the caster picks, the GM may override from the card). */
async function showChangePopup(message) {
  const flag = message.getFlag(MODULE_ID, TRANSFORM_FLAG);
  if ( !flag?.applied || flag.ended || !game.user.isGM ) return;
  const pool = await poolFor(flag);
  const { html, capLabel } = await galleryHTML(flag, pool, { field: "bf-form-change", gm: true });
  const dialog = await openMomentPopup(message, "transformChange", null, {
    title: `${flag.itemName} — change the form`, icon: "fa-solid fa-paw", width: 500, gate: false,
    content: bfCard({ eyebrow: "Transform", tone: "pending", title: `Change ${flag.pick?.name ?? "the form"}`, subtitle: [capLabel, "the GM's override · the creature reverts and takes the new form"].filter(Boolean).join(" · "), lines: [html] }),
    buttons: [
      { action: "change", label: "Change the form", default: true, callback: (_event, button) => {
        const pick = pickFrom(button.form, pool, "bf-form-change");
        if ( !pick ) { ui.notifications?.warn(`${TITLE}: answer first — pick a form.`); return; }
        void queueFlagWrite(message, TRANSFORM_FLAG, current => {
          if ( !current.applied || current.ended || current.changeAsked ) return false;
          current.changeAsked = { uuid: pick.uuid, name: pick.name, img: pick.img ?? null, askedAt: Date.now() };
        });
      } },
      { action: "cancel", label: "Keep it" }
    ]
  });
  lockRows(dialog?.element ?? null);
  wireGallerySearch(dialog?.element ?? null);
}

/* --- the elect transforms --------------------------------------------------------------------- */

/** The caster's Concentration effect on the item, when the row's clock is Concentration's. */
function concentrationFor(caster, flag) {
  if ( !caster ) return null;
  if ( flag.concentrationId ) { const e = caster.effects.get(flag.concentrationId); if ( e ) return e; }
  const itemId = flag.itemUuid?.split(".").at(-1) ?? null;
  return caster.effects.find(e => (e.statuses?.has?.("concentrating") || (e.system?.type === "concentrating"))
    && ((e.flags?.dnd5e?.item?.id === itemId) || (e.origin === flag.itemUuid))) ?? null;
}

/** The activity on a creature's own sheet that the card names — by uuid, else the item by name and its transform activity. */
function activityFor(actor, flag, message) {
  const live = cardActivity(message, flag.activityUuid);
  if ( live && (live.actor === actor) ) return live;
  const item = [...(actor?.items ?? [])].find(i => lower(i.name) === lower(flag.itemName)) ?? null;
  const acts = [...(item?.system?.activities ?? [])];
  return acts.find(a => a.id === flag.activityUuid?.split(".").at(-1)) ?? acts.find(a => a.type === "transform") ?? live ?? null;
}

/** The original behind a transformed creature: itself when untransformed, else the actor its flag names. */
const originalOf = actor => (actor?.isPolymorphed && !actor.isToken) ? (game.actors.get(actor.getFlag("dnd5e", "originalActor")) ?? actor) : actor;

/** Our form effect on a creature, or null. */
const formEffectOn = actor => [...(actor?.effects ?? [])].find(e => !!e.getFlag(MODULE_ID, FORM_FLAG)) ?? null;

/**
 * One creature into the form: a standing form of ours reverted first ("until you use Wild Shape
 * again"), then dnd5e's own `transformInto` with the activity's own settings, then the form effect on
 * what came out. Returns the transformed actor's facts.
 */
async function transformOne(subject, source, { activity, settings, flag, pick, message }) {
  let target = subject;
  if ( formEffectOn(target) && target.isPolymorphed ) {
    const back = await target.revertOriginalForm({ renderSheet: false });
    target = (back instanceof Actor) ? back : (back?.actor ?? originalOf(target));
  }
  const before = new Set(game.actors.map(a => a.id));
  await target.transformInto(source, settings, { renderSheet: false });
  const landed = target.isToken ? target : (game.actors.find(a => !before.has(a.id) && (a.getFlag("dnd5e", "originalActor") === target.id)) ?? null);
  if ( !landed ) throw new Error(`${target.name} was not transformed`);
  const row = TRANSFORMS[flag.key];
  const caster = resolveUuid(flag.sourceUuid);
  const concentration = (row.clock === "concentration") ? concentrationFor(caster, flag) : null;
  const duration = concentration ? { ...(concentration._source?.duration ?? {}) } : (row.clock === "activity") ? (activity?.duration?.getEffectData?.() ?? {}) : {};
  if ( row.clock || (row.ends ?? []).length ) {
    const data = formEffectData({ itemName: flag.itemName, formName: pick.name, img: pick.img ?? source.img ?? null, origin: flag.itemUuid,
      duration, messageId: message.id, originalId: target.id, key: flag.key, dependentOn: concentration?.uuid ?? null,
      description: `<p>${esc(flag.sourceName)}'s ${esc(flag.itemName)}: ${esc(target.name)} in the form of ${esc(articleOf(pick.name))} ${esc(pick.name)}. Removing this ends the form.</p>` });
    await landed.createEmbeddedDocuments("ActiveEffect", [data]);
  }
  return { actorUuid: landed.uuid, originalUuid: target.uuid, name: landed.name, tokenName: landed.isToken ? landed.token?.name : null };
}

async function landTransform(message) {
  let claimed = false;
  await queueFlagWrite(message, TRANSFORM_FLAG, current => {
    if ( (current.status !== "picked") || current.applied || current.applying ) return false;
    current.applying = true;
    claimed = true;
  });
  if ( !claimed ) return;
  const flag = message.getFlag(MODULE_ID, TRANSFORM_FLAG);
  const landed = [];
  let outcome = "landed";
  let failure = null;
  let learned = null;
  try {
    const caster = resolveUuid(flag.sourceUuid);
    if ( !(caster instanceof Actor) ) throw new Error("the caster could not be read off the card");
    const source = await fromUuid(flag.pick?.uuid);
    if ( !(source instanceof Actor) ) throw new Error(`no creature at ${flag.pick?.uuid}`);
    const original = originalOf(caster);
    const activity = activityFor(original, flag, message);
    if ( !activity ) throw new Error(`${flag.itemName} is not on ${original.name}'s sheet`);
    // The learned form first, on the original's own item — the copy a transform makes would lose it.
    if ( flag.learn?.uuid ) {
      const holder = knownHolderItem(original, flag.key);
      const list = holder ? learnedList({ known: knownOf(holder), slots: Number(flag.slots) || 0, learn: flag.learn }) : null;
      if ( holder && list ) { await holder.setFlag(MODULE_ID, KNOWN_FORMS_FLAG, list); learned = { ...flag.learn }; }
    }
    const holder = knownHolderItem(original, flag.key);
    if ( holder && (Number(flag.slots) > 0) ) await holder.setFlag(MODULE_ID, LAST_FORM_FLAG, flag.pick.uuid);
    const settings = activity.settings ?? undefined;
    for ( const t of flag.targets ?? [] ) {
      const subject = resolveUuid(t.uuid);
      if ( !(subject instanceof Actor) ) { failure = `${t.name} is not on any scene`; continue; }
      landed.push(await transformOne(subject, source, { activity, settings, flag, pick: flag.pick, message }));
    }
    if ( !landed.length ) throw new Error(failure ?? "nobody to transform");
  } catch(err) {
    console.error(`${TITLE} | The transform could not be landed — transform by hand.`, err);
    outcome = "failed";
    failure = String(err?.message ?? err);
  } finally {
    await queueFlagWrite(message, TRANSFORM_FLAG, current => {
      current.applied = true; current.applying = false; current.outcome = outcome; current.landed = landed;
      if ( failure ) current.failure = failure;
      if ( learned ) current.learned = learned;
    });
  }
}

/** The GM's change: every landed creature reverted and transformed again into the new pick. */
async function changeTransform(message) {
  let claimed = false;
  await queueFlagWrite(message, TRANSFORM_FLAG, current => {
    if ( !current.applied || current.ended || !current.changeAsked || current.changing ) return false;
    current.changing = true;
    claimed = true;
  });
  if ( !claimed ) return;
  const flag = message.getFlag(MODULE_ID, TRANSFORM_FLAG);
  const pick = { uuid: flag.changeAsked.uuid, name: flag.changeAsked.name, img: flag.changeAsked.img ?? null };
  const landed = [];
  let failure = null;
  try {
    const source = await fromUuid(pick.uuid);
    if ( !(source instanceof Actor) ) throw new Error(`no creature at ${pick.uuid}`);
    const caster = resolveUuid(flag.sourceUuid);
    for ( const l of flag.landed ?? [] ) {
      const current = resolveUuid(l.actorUuid) ?? resolveUuid(l.originalUuid);
      if ( !(current instanceof Actor) ) continue;
      const original = originalOf(current);
      const activity = activityFor(originalOf(caster) ?? original, flag, message);
      landed.push(await transformOne(current, source, { activity, settings: activity?.settings, flag, pick, message }));
    }
  } catch(err) {
    console.error(`${TITLE} | The form could not be changed — transform by hand.`, err);
    failure = String(err?.message ?? err);
  } finally {
    await queueFlagWrite(message, TRANSFORM_FLAG, current => {
      current.changing = false;
      current.changed = [...(current.changed ?? []), { from: current.pick, to: pick, at: Date.now(), ...(failure ? { failure } : {}) }];
      if ( !failure ) { current.pick = pick; current.landed = landed; }
      delete current.changeAsked;
    });
  }
}

/* --- the form ends --------------------------------------------------------------------------- */

/** Actors this client is reverting right now — one revert per creature, whatever fires it. */
const reverting = new Set();

/**
 * The elect ends a form: dnd5e's own revert, the record stamped `ended`, the card said. Idempotent:
 * a creature not transformed, or already reverting, is left alone.
 * @param {Actor} actor   the transformed creature
 * @param {{ why: string, word: string }} ended
 */
async function revertForm(actor, ended) {
  const form = formEffectOn(actor)?.getFlag(MODULE_ID, FORM_FLAG) ?? null;
  const key = actor.isToken ? actor.token.uuid : actor.id;
  if ( !actor.isPolymorphed || reverting.has(key) ) return;
  reverting.add(key);
  const message = form?.messageId ? game.messages.get(form.messageId) : null;
  const flag = message?.getFlag(MODULE_ID, TRANSFORM_FLAG) ?? null;
  const formName = flag?.pick?.name ?? actor.name;
  const who = actor.isToken ? (actor.token?.name ?? actor.name) : (originalOf(actor)?.name ?? actor.name);
  try {
    await actor.revertOriginalForm({ renderSheet: false });
    if ( message && flag && !flag.ended ) {
      await queueFlagWrite(message, TRANSFORM_FLAG, current => {
        if ( current.ended ) return false;
        current.ended = { why: ended.why, word: ended.word, at: Date.now() };
      });
    }
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: originalOf(actor) ?? actor }),
      content: bfCard({ eyebrow: flag?.itemName ?? "Transform", tone: "neutral", title: formTitle({ who, form: formName, ended }),
        subtitle: (ended.word === "revert") ? "reverted by choice" : "the form ends" }),
      flags: { [MODULE_ID]: { formEnd: { messageId: message?.id ?? null, actorUuid: actor.uuid, why: ended.why, word: ended.word, ...statContext(flag?.sourceUuid ?? null) } } }
    });
  } catch(err) {
    console.error(`${TITLE} | ${actor.name} could not be reverted — use the sheet's Restore Transformation.`, err);
  } finally {
    reverting.delete(key);
  }
}

// The hours ran out: Foundry marks the effect expired on the GM client, dnd5e deletes it there; either way the elect reverts.
listen("updateActiveEffect", "transforms", (effect, changes) => {
  try {
    if ( (changes?.duration?.expired !== true) || !effect.getFlag(MODULE_ID, FORM_FLAG) || !isActiveGM() ) return;
    const actor = effect.parent;
    if ( actor instanceof Actor ) void revertForm(actor, { word: "clock", why: "the time ran out" });
  } catch(err) { console.error(`${TITLE} | The form's clock could not end it.`, err); }
});

// The effect removed — Revert on the bar, Concentration's end taking its dependent, a hand: the form ends with it.
listen("deleteActiveEffect", "transforms", effect => {
  try {
    if ( !effect.getFlag(MODULE_ID, FORM_FLAG) || !isActiveGM() ) return;
    const actor = effect.parent;
    if ( !(actor instanceof Actor) ) return;
    if ( !actor.isToken && !game.actors.get(actor.id) ) return;   // the copy itself is going: a revert already ran
    const dependent = !!effect.getFlag("dnd5e", "dependentOn");
    void revertForm(actor, dependent ? { word: "concentration", why: "Concentration ended" } : { word: "revert", why: "the form was ended" });
  } catch(err) { console.error(`${TITLE} | The form's end could not run.`, err); }
});

// 0 Hit Points, or the Temporary Hit Points gone: read off the creature's own update.
listen("updateActor", "transforms", (actor, changes) => {
  try {
    if ( !isActiveGM() || !(actor instanceof Actor) ) return;
    const form = formEffectOn(actor)?.getFlag(MODULE_ID, FORM_FLAG);
    if ( !form ) return;
    const hp = changes?.system?.attributes?.hp;
    if ( !hp || !(("value" in hp) || ("temp" in hp)) ) return;
    const ended = endOfForm(TRANSFORMS[form.key]?.ends ?? [], { hpValue: ("value" in hp) ? hp.value : null, tempValue: ("temp" in hp) ? hp.temp : null });
    if ( ended ) void revertForm(actor, ended);
  } catch(err) { console.error(`${TITLE} | The form's end could not be read off the update.`, err); }
});

// The Incapacitated condition lands on the creature in its form.
listen("createActiveEffect", "transforms", effect => {
  try {
    if ( !isActiveGM() ) return;
    const actor = effect.parent;
    if ( !(actor instanceof Actor) || effect.getFlag(MODULE_ID, FORM_FLAG) ) return;
    const form = formEffectOn(actor)?.getFlag(MODULE_ID, FORM_FLAG);
    if ( !form ) return;
    const ended = endOfForm(TRANSFORMS[form.key]?.ends ?? [], { statuses: [...(effect.statuses ?? [])] });
    if ( ended ) void revertForm(actor, ended);
  } catch(err) { console.error(`${TITLE} | The form's end could not be read off the condition.`, err); }
});

/** The owner (on their own card) or a GM asks to revert; the elect executes it. */
async function askRevert(message) {
  await queueFlagWrite(message, TRANSFORM_FLAG, current => {
    if ( !current.applied || current.ended || current.revertAsked ) return false;
    current.revertAsked = true;
  });
}

async function driveRevert(message) {
  const flag = message.getFlag(MODULE_ID, TRANSFORM_FLAG);
  let any = false;
  for ( const l of flag.landed ?? [] ) {
    const actor = resolveUuid(l.actorUuid);
    if ( (actor instanceof Actor) && actor.isPolymorphed ) { any = true; await revertForm(actor, { word: "revert", why: "reverted by choice" }); }
  }
  await queueFlagWrite(message, TRANSFORM_FLAG, current => {
    if ( !current.ended ) current.ended = { why: any ? "reverted by choice" : "nothing was still transformed", word: "revert", at: Date.now() };
  });
}

registerResumable(TRANSFORM_FLAG, {
  pending: flag => !!flag && (((flag.status === "picked") && !flag.applied && !flag.applying)
    || (flag.applied && !flag.ended && ((flag.revertAsked === true) || (!!flag.changeAsked && !flag.changing)))),
  drives: () => isActiveGM(),
  drive: async message => {
    const flag = message.getFlag(MODULE_ID, TRANSFORM_FLAG);
    if ( !flag.applied ) await landTransform(message);
    else if ( flag.revertAsked ) await driveRevert(message);
    else if ( flag.changeAsked ) await changeTransform(message);
  }
});

/* --- the card says it (R5) ------------------------------------------------------------------- */

function drawTransform(message, html, flag) {
  const row = document.createElement("div");
  row.className = "battleflow-transform";
  const user = resolveUuid(flag.sourceUuid);
  const mine = canAnswerFor(user);
  const who = flag.self ? flag.sourceName : (flag.targets ?? []).map(t => t.name).join(", ");
  const form = flag.pick?.name ?? "the form";
  if ( flag.status === "asked" ) {
    if ( !mine ) return;
    const shownKey = popupKey(message.id, TRANSFORM_FLAG);
    if ( !shownMoments.has(shownKey) ) { shownMoments.add(shownKey); void showFormPopup(message); }
    row.appendChild(momentButton("Pick the form", () => { void showFormPopup(message); }, { margin: "0.25rem 0 0" }));
    html.querySelector(SURFACES.messageContent)?.appendChild(row);
    return;
  }
  if ( !flag.applied ) {
    const gm = !!game.users.activeGM;
    row.innerHTML = bfCard({ eyebrow: "Transform", tone: "pending", title: `${who} — ${articleOf(form)} ${form}, picked`,
      subtitle: gm ? "waiting for the GM's client to transform" : "no GM online — the form lands when a GM connects" });
  } else if ( flag.outcome === "failed" ) {
    row.innerHTML = bfCard({ eyebrow: "Transform", tone: "bad", title: formTitle({ who, form, failed: true }), subtitle: `${flag.failure ?? "see the console"} · transform by hand` });
  } else if ( flag.ended ) {
    row.innerHTML = bfCard({ eyebrow: "Transform", tone: "neutral", title: formTitle({ who, form, ended: flag.ended }) });
  } else {
    const learned = flag.learned ? `${flag.learned.name} learned as a known form` : null;
    row.innerHTML = bfCard({ eyebrow: "Transform", tone: "good", title: formTitle({ who, form }),
      subtitle: [learned, "transformed by the GM's client", (flag.changed?.length ? `changed by the GM from ${flag.changed.at(-1).from?.name ?? "the first form"}` : null)].filter(Boolean).join(" · ") });
    if ( (mine || game.user.isGM) && !flag.revertAsked ) row.appendChild(momentButton("Revert", () => { void askRevert(message); }, { margin: "0.25rem 0 0" }));
    if ( game.user.isGM && !flag.changeAsked && !flag.revertAsked ) row.appendChild(momentButton("Change the form", () => { void showChangePopup(message); }, { margin: "0.25rem 0 0" }));
    if ( flag.revertAsked ) row.appendChild(Object.assign(document.createElement("em"), { textContent: "reverting…" }));
    else if ( flag.changeAsked ) row.appendChild(Object.assign(document.createElement("em"), { textContent: `changing to ${flag.changeAsked.name}…` }));
  }
  html.querySelector(SURFACES.messageContent)?.appendChild(row);
}

/* --- the Long Rest: the one known-form swap ---------------------------------------------------- */

/** The resting character's Wild Shape holders: every listed row with slots whose item is on the sheet, one card each. */
function holdersOf(actor) {
  const out = [];
  const seen = new Set();
  for ( const [key, row] of Object.entries(TRANSFORMS) ) {
    if ( (typeof row.known !== "number") || !listed().has(lower(key)) ) continue;
    const item = featureNamed(actor, key);
    if ( !item || seen.has(item.id) ) continue;
    seen.add(item.id);
    out.push({ key, item, slots: row.known });
  }
  return out;
}

// The resting owner's client posts the ask (the mastery swap's road): every Long Rest shows the list.
listen("dnd5e.restCompleted", "transforms", (actor, result, config) => {
  try {
    if ( !(actor instanceof Actor) || !actor.isOwner || (actor.type !== "character") ) return;
    if ( ((result?.type ?? config?.type) !== "long") || !isPartyMember(actor.uuid) ) return;
    for ( const h of holdersOf(actor) ) {
      const known = knownOf(h.item);
      const state = knownState({ known, slots: h.slots });
      const activity = [...(h.item.system?.activities ?? [])].find(a => a.type === "transform") ?? null;
      const profile = activity?.availableProfiles?.[0] ?? null;
      const flag = { status: "pending", key: h.key, actorUuid: actor.uuid, actorName: actor.name, itemUuid: h.item.uuid, itemName: h.item.name,
        slots: h.slots, open: state.open, known,
        profile: profile ? { id: profile._id, cr: capOf(activity, profile), types: [...(profile.types ?? [])], sizes: [...(profile.sizes ?? [])], movement: [...(profile.movement ?? [])] } : null,
        restAt: Date.now(), ...statContext(actor.uuid) };
      void ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: bfCard({ eyebrow: h.item.name, tone: "pending",
          title: state.open ? `${actor.name} — ${state.open} open known form${state.open === 1 ? "" : "s"}` : `${actor.name} — swap a known form?`,
          subtitle: "chosen at the Long Rest · one swap" }),
        flags: { [MODULE_ID]: { [FORM_SWAP_FLAG]: flag } }
      }).catch(err => console.error(`${TITLE} | The known-form swap could not be asked.`, err));
    }
  } catch(err) {
    console.error(`${TITLE} | The known-form swap failed at the rest's end.`, err);
  }
});

/** The owner's answer — a swap (`out`, `into`), the open slots filled (`adds`), or a keep; the card's owner writes it, anyone else relays. */
export async function answerFormSwap(message, { out = null, into = null, adds = null, declined = false } = {}) {
  const flag = message.getFlag(MODULE_ID, FORM_SWAP_FLAG);
  if ( flag?.status !== "pending" ) return;
  const answer = declined ? { declined: true } : { out, into, adds: [...(adds ?? [])] };
  if ( message.isOwner || isActiveGM() ) {
    await queueFlagWrite(message, FORM_SWAP_FLAG, current => {
      if ( current.status !== "pending" ) return false;
      Object.assign(current, { status: "resolved", answeredAt: Date.now(), ...answer });
    });
    return;
  }
  if ( !game.users.activeGM ) { ui.notifications?.warn(`${TITLE}: a GM must be on to land the change.`); return; }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: resolveUuid(flag.actorUuid) }),
    content: "", whisper: game.users.filter(u => u.isGM).map(u => u.id),
    flags: { [MODULE_ID]: { formSwapAnswer: { messageId: message.id, ...answer } } }
  });
}

registerRelay("formSwapAnswer", {
  flagKey: FORM_SWAP_FLAG,
  targetOf: a => a.messageId,
  owns: () => isActiveGM(),
  cleanup: true,
  fold: (current, a) => {
    if ( current.status !== "pending" ) return false;
    const answer = a.declined ? { declined: true } : { out: a.out ?? null, into: a.into ?? null, adds: [...(a.adds ?? [])] };
    Object.assign(current, { status: "resolved", answeredAt: Date.now(), ...answer });
  }
});

/** The elect lands the answer on the item, judged against the list as it stands now. */
async function landFormSwap(message) {
  let claimed = false;
  await queueFlagWrite(message, FORM_SWAP_FLAG, current => {
    if ( (current.status !== "resolved") || current.applied || current.applying ) return false;
    current.applying = true;
    claimed = true;
  });
  if ( !claimed ) return;
  const flag = message.getFlag(MODULE_ID, FORM_SWAP_FLAG);
  let outcome = "kept";
  let after = null;
  try {
    const actor = resolveUuid(flag.actorUuid);
    // live only: the Known Forms are a flag on the sheet's own Wild Shape item, which a Long Rest never uses up
    const item = resolveUuid(flag.itemUuid) ?? ((actor instanceof Actor) ? featureNamed(actor, flag.key) : null);
    if ( !flag.declined && item ) {
      const known = knownOf(item);
      const list = restKnownList({ known, slots: Number(flag.slots) || 0, out: flag.out, into: flag.into, adds: flag.adds ?? [] });
      if ( list && (JSON.stringify(list) !== JSON.stringify(known)) ) { await item.setFlag(MODULE_ID, KNOWN_FORMS_FLAG, list); outcome = "changed"; }
      else if ( list ) outcome = "kept";
      else outcome = "stale";
    }
    if ( item ) after = knownOf(item);
  } catch(err) {
    console.error(`${TITLE} | ${flag.actorName}'s known forms could not be changed.`, err);
    outcome = "failed";
  } finally {
    await queueFlagWrite(message, FORM_SWAP_FLAG, current => {
      current.applied = true; current.applying = false; current.outcome = outcome;
      if ( after ) current.after = after;
    });
  }
}

registerResumable(FORM_SWAP_FLAG, {
  pending: flag => (flag?.status === "resolved") && !flag.applied && !flag.applying,
  drives: () => isActiveGM(),
  drive: landFormSwap
});

/** The known forms as rows the swap popups draw, each described off its creature. */
async function knownRowsHTML(known, pool, { field = null, lastForm = null } = {}) {
  const parts = [];
  for ( const k of known ) {
    const row = poolRowFor(pool, k);
    const described = await describeRow(row ?? { uuid: k.uuid, name: k.name, img: k.img });
    parts.push(formRowHTML(described, { field: field ?? "bf-form-shown", value: k.uuid, right: (row ? poolRight(row) : "") + ((k.uuid === lastForm) ? "<br>last used" : "") }));
  }
  return parts.join("");
}

async function showSwapPopup(message) {
  const flag = message.getFlag(MODULE_ID, FORM_SWAP_FLAG);
  if ( flag?.status !== "pending" ) return;
  const actor = resolveUuid(flag.actorUuid);
  if ( !actor ) return;
  const pool = await poolFromPacks({ types: flag.profile?.types?.length ? flag.profile.types : ["beast"] });
  const rule = poolRuleOf(flag.profile ?? {}, {});
  const allowed = galleryRows(pool, rule).filter(r => !(flag.known ?? []).some(k => k.uuid === r.uuid));
  const open = Number(flag.open) || 0;
  const have = `<div><b>You know these forms</b>${flag.known?.length ? " — tick one to swap it out, or keep them:" : ":"}</div>`
    + (flag.known?.length ? await knownRowsHTML(flag.known, pool, { field: "bf-form-out" }) : "<em>none yet</em>")
    + (open ? `<div style="opacity:0.75;font-size:var(--font-size-11,11px);margin:0.2rem 0;">${open} slot${open === 1 ? "" : "s"} open — pick that many below to fill them.</div>` : "");
  const dialog = await openMomentPopup(message, FORM_SWAP_FLAG, actor, {
    title: `${flag.itemName} — ${flag.actorName}`, icon: "fa-solid fa-paw", width: 500,
    content: bfCard({
      eyebrow: flag.itemName, tone: "pending",
      title: open ? "Choose your known forms" : "Swap a known form?",
      subtitle: `${flag.known?.length ?? 0} of ${flag.slots} known · one swap per Long Rest · ${capLabelOf(rule) || "any form the rule allows"}`,
      lines: [have, poolListHTML(allowed, { field: "bf-form-in", head: open ? "Fill the open slots" : "Available" })]
    }),
    buttons: [
      { action: "ok", label: "OK", default: true, callback: (_event, button) => {
        const out = button.form.querySelector('input[name="bf-form-out"]:checked')?.value || null;
        const picks = [...button.form.querySelectorAll('input[name="bf-form-in"]:checked')].map(i => i.value)
          .map(uuid => pool.find(r => r.uuid === uuid)).filter(Boolean).map(r => ({ uuid: r.uuid, name: r.name, img: r.img ?? null }));
        if ( !picks.length ) { void answerFormSwap(message, { declined: true }); return; }
        const into = out ? (picks.shift() ?? null) : null;
        void answerFormSwap(message, { out: into ? out : null, into, adds: picks });
      } },
      { action: "keep", label: "Keep them", callback: () => { void answerFormSwap(message, { declined: true }); } }
    ]
  });
  wireSwapGrid(dialog?.element ?? null, { open });
  wireGallerySearch(dialog?.element ?? null);
}

/** One swap: with a known form ticked out, one pick; else as many picks as slots are open. */
function wireSwapGrid(root, { open }) {
  if ( !root?.querySelectorAll ) return;
  const outs = [...root.querySelectorAll('input[name="bf-form-out"]')];
  const ins = [...root.querySelectorAll('input[name="bf-form-in"]')];
  for ( const o of outs ) o.type = "checkbox";
  for ( const i of ins ) i.type = "checkbox";
  const sync = () => {
    const removed = outs.filter(o => o.checked).length;
    const free = open + removed;
    const picked = ins.filter(i => i.checked).length;
    for ( const i of ins ) {
      i.disabled = !i.checked && (picked >= free);
      const row = i.closest("[data-bf-form]");
      if ( row ) row.style.opacity = i.disabled ? "0.45" : "";
    }
  };
  for ( const o of outs ) o.addEventListener("change", () => { if ( o.checked ) for ( const x of outs ) if ( x !== o ) x.checked = false; sync(); });
  for ( const i of ins ) i.addEventListener("change", sync);
  sync();
}

/** What the landed answer did, in words (plain text: the card escapes its title). */
function swapLine(flag) {
  if ( flag.outcome === "changed" ) {
    const parts = [];
    if ( flag.adds?.length ) parts.push(`Learned ${flag.adds.map(a => a.name).join(", ")}`);
    if ( flag.out && flag.into ) parts.push(`${parts.length ? "swapped" : "Swapped"} ${(flag.known ?? []).find(k => k.uuid === flag.out)?.name ?? "a form"} → ${flag.into.name}`);
    return parts.join(" · ") || "Changed";
  }
  if ( flag.outcome === "stale" ) return "The change no longer fit the list — kept";
  if ( flag.outcome === "failed" ) return "The change could not be written";
  return "Kept";
}

/** The confirmation after the landing: what you know now and what changed, OK. */
async function showSwapDone(message, flag) {
  const actor = resolveUuid(flag.actorUuid);
  const pool = await poolFromPacks({ types: flag.profile?.types?.length ? flag.profile.types : ["beast"] });
  await openMomentPopup(message, "formSwapDone", actor, {
    title: `${flag.itemName} — ${flag.actorName}`, icon: "fa-solid fa-paw", width: 500,
    content: bfCard({
      eyebrow: flag.itemName, tone: (flag.outcome === "changed") ? "good" : "neutral",
      title: swapLine(flag), subtitle: `${(flag.after ?? flag.known ?? []).length} of ${flag.slots} known`,
      lines: [`<div><b>You now know these forms:</b></div>${await knownRowsHTML(flag.after ?? flag.known ?? [], pool)}`]
    }),
    buttons: [{ action: "ok", label: "OK", default: true, callback: () => acknowledgeMoment(message, FORM_SWAP_FLAG) }]
  });
}

function drawSwap(message, html, flag) {
  const row = document.createElement("div");
  row.className = "battleflow-transform";
  const actor = resolveUuid(flag.actorUuid);
  if ( flag.status === "pending" ) {
    if ( !canAnswerFor(actor) ) return;
    const shownKey = popupKey(message.id, FORM_SWAP_FLAG);
    if ( !shownMoments.has(shownKey) ) { shownMoments.add(shownKey); void showSwapPopup(message); }
    row.appendChild(momentButton("Answer", () => { void showSwapPopup(message); }, { margin: "0.25rem 0 0" }));
    html.querySelector(SURFACES.messageContent)?.appendChild(row);
    return;
  }
  if ( !flag.applied ) return;
  const names = (flag.after ?? flag.known ?? []).map(k => `<b>${esc(k.name)}</b>`).join(", ") || "<em>none yet</em>";
  row.innerHTML = bfCard({ eyebrow: flag.itemName, tone: (flag.outcome === "changed") ? "good" : "neutral",
    title: swapLine(flag), subtitle: flag.actorName, lines: [`Known forms: ${names}`] });
  html.querySelector(SURFACES.messageContent)?.appendChild(row);
  if ( canAnswerFor(actor) && !momentAcknowledged(message, FORM_SWAP_FLAG) ) {
    const shownKey = popupKey(message.id, "formSwapDone");
    if ( !shownMoments.has(shownKey) ) { shownMoments.add(shownKey); void showSwapDone(message, flag); }
    row.appendChild(momentButton("OK", () => { void showSwapDone(message, flag); }, { margin: "0.25rem 0 0" }));
  }
}

listen("dnd5e.renderChatMessage", "transforms", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, TRANSFORM_FLAG);
    if ( flag ) drawTransform(message, html, flag);
    const swap = message.getFlag(MODULE_ID, FORM_SWAP_FLAG);
    if ( swap ) drawSwap(message, html, swap);
  } catch(err) {
    console.error(`${TITLE} | The transform's row could not be drawn.`, err);
  }
});

listen("ready", "transforms", () => {
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = Object.assign(mod.api ?? {}, { transforms: { showFormPopup, askRevert, answerFormSwap, knownOf } });
});
