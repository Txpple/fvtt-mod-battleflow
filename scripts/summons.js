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
import { MODULE_ID, readFlag, TITLE, activeCombatFor, isActiveGM, queueFlagWrite, canAnswerFor, statContext } from "./core.js";
import { cardActivity, lower, resolveUuid } from "./lookup.js";
import { SUMMON_CHOICES, summonChoiceEntries, summonOwnInitiativeEntries, summonSingleEntries, listedNames } from "./decide/registry.js";
import { profileRows, choiceRowKey, formNeeds, poolPicks, summonRecord, placedAnswer, narrowedActivities, resistanceEffectData,
  ownershipGrant, seatInitiative, rangeFeet, replacedSummons } from "./decide/summons.js";
import { bfCard, popupKey } from "./decide/present.js";
import { concentrationIdOf } from "./decide/card.js";
import { effectRecord, joinEffectReceipt } from "./decide/receipt.js";
import { describeCreature, openPicker, pickSpots, poolFromPacks } from "./gallery.js";
import { momentButton, registerResumable, shownMoments } from "./ui.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const SUMMON_FLAG = "summon";
const listed = () => listedNames(summonChoiceEntries());

/** A summon activity the module takes off the system's hands: one with a profile the cast may use. */
const takes = activity => (activity?.type === "summon") && !!activity.availableProfiles?.length;

/* --- the intercept: the system places nothing ---------------------------------------------------- */

// The usage dialog's Creation section (Place Summons, and the system's own profile, size and type selects)
// is hidden as well as switched off: ticked, it would start dnd5e's placement beside the module's
// (RULINGS *Summons*). `display` is the dialog's own switch (`_shouldDisplay("create.summons")`).
listen("dnd5e.preUseActivity", "summons", (activity, usageConfig, dialogConfig) => {
  try {
    if ( !takes(activity) ) return;
    usageConfig.create ??= {};
    usageConfig.create.summons = false;
    if ( dialogConfig ) {
      dialogConfig.options ??= {};
      dialogConfig.options.display ??= {};
      foundry.utils.setProperty(dialogConfig.options.display, "create.summons", false);
    }
  } catch(err) { console.warn(`${TITLE} | Could not switch the system's summoning off.`, err); }
});

/* --- the record on the cast card ------------------------------------------------------------------ */

/** A form row's label, art and lines, read off the creature it names (a compendium read, no permission). */
async function describeProfile(row) {
  if ( !row.uuid ) return { ...row, label: row.name || `a creature of CR ${row.cr ?? "?"}${row.types.length ? ` (${row.types.join(", ")})` : ""}`, img: null, summary: null };
  return { ...row, ...(await describeCreature(row.uuid, { label: row.name || "" })) };
}

async function stampRecord(activity, message) {
  const actor = activity.actor;
  const tok = actor.token ?? activity.getUsageToken?.() ?? actor.getActiveTokens?.(true, true)?.[0] ?? null;
  const rows = await Promise.all(profileRows(activity.profiles.map(p => p.toObject?.() ?? p), activity.relevantLevel).map(describeProfile));
  const record = summonRecord({
    sourceUuid: actor.uuid, sourceName: tok?.name ?? actor.name,
    itemUuid: activity.item.uuid, itemName: activity.item.name, activityUuid: activity.uuid,
    level: activity.relevantLevel, profiles: rows,
    choice: choiceRowKey(SUMMON_CHOICES, activity.item.name, listed()),
    concentrationId: concentrationIdOf(message), sceneId: tok?.parent?.id ?? canvas.scene?.id ?? null,
    mode: activity.summon?.mode ?? null, creatureTypes: [...(activity.creatureTypes ?? [])],
    creatureSizes: [...(activity.creatureSizes ?? [])], rangeFt: rangeFeet(activity.range)
  });
  await message.setFlag(MODULE_ID, SUMMON_FLAG, { ...record, ...statContext(actor.uuid) });
}

listen("dnd5e.postUseActivity", "summons", (activity, _usageConfig, results) => {
  try {
    if ( !takes(activity) || !activity.actor?.isOwner ) return;
    const message = (results?.message instanceof ChatMessage) ? results.message : null;
    if ( !message ) return;
    void stampRecord(activity, message).catch(err => console.error(`${TITLE} | Could not stamp the summon on the card — place the creature by hand.`, err));
  } catch(err) {
    console.error(`${TITLE} | The summon could not be recorded — place the creature by hand.`, err);
  }
});

/* --- the one popup: the form, the choice, the pool, then the placement ---------------------------- */

/** The pool a `cr`-mode profile picks from: the cap evaluated, the profile's types. */
function poolRuleOf(profile) {
  const cap = profile.cr === null ? null : Number(Roll.safeEval?.(profile.cr) ?? profile.cr);
  return { crMax: Number.isFinite(cap) ? cap : null, types: profile.types?.length ? profile.types : null };
}

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

async function answerPlacement(message, flag, answer) {
  const patch = placedAnswer(flag, answer, SUMMON_CHOICES);
  if ( !patch ) { ui.notifications?.warn(`${TITLE}: the summon's answer was not one the spell allows.`); return; }
  await queueFlagWrite(message, SUMMON_FLAG, current => {
    if ( current.status !== "asked" ) return false;
    Object.assign(current, patch);
  });
}

async function showSummonPopup(message) {
  const flag = readFlag(message, SUMMON_FLAG);
  if ( flag?.status !== "asked" ) return;
  const caster = resolveUuid(flag.sourceUuid);
  if ( !caster ) return;
  const types = flag.creatureTypes ?? [];
  const sizes = flag.creatureSizes ?? [];
  const needs = formNeeds({ profiles: flag.profiles, choice: flag.choice, mode: flag.mode, creatureTypes: types, creatureSizes: sizes });
  const poolProfile = flag.profiles.find(p => poolPicks(p, flag.mode)) ?? null;
  const pool = (needs.pool && poolProfile) ? await poolFromPacks(poolRuleOf(poolProfile)) : [];
  const choiceRow = needs.choice ? SUMMON_CHOICES[flag.choice] : null;
  const profileRow = (p, checked) => ({ value: p.id, label: p.label || p.name, img: p.img ?? null, summary: p.summary, checked });
  const sections = [];
  if ( needs.profile ) sections.push({ head: "The form", field: "bf-summon-profile", rows: flag.profiles.map((p, i) => profileRow(p, i === 0)) });
  else if ( (flag.profiles.length === 1) && !needs.pool ) sections.push({ field: "bf-summon-profile", rows: [profileRow(flag.profiles[0], true)] });
  if ( needs.pool ) sections.push({ field: "bf-summon-pick", pool });
  if ( needs.type ) sections.push({ head: "Its creature type", field: "bf-summon-type", pills: types.map(t => ({ value: t, label: CONFIG.DND5E?.creatureTypes?.[t]?.label ?? t })) });
  if ( needs.size ) sections.push({ head: "Its size", field: "bf-summon-size", pills: sizes.map(s => ({ value: s, label: CONFIG.DND5E?.actorSizes?.[s]?.label ?? s })) });
  if ( choiceRow ) {
    sections.push({ head: choiceRow.ask, field: "bf-summon-choice", pills: choiceRow.options.map(o => ({ value: o, label: CONFIG.DND5E?.damageTypes?.[o]?.label ?? o })) });
    sections.push({ rule: choiceRow.rule });
  }
  // what must be picked, in the order the popup reads (the creature, its type and size, the spell's own question)
  const asked = [
    needs.pool ? { field: "bf-summon-pick", why: "pick the creature first" } : null,
    needs.type ? { field: "bf-summon-type", why: "pick its creature type first" } : null,
    needs.size ? { field: "bf-summon-size", why: "pick its size first" } : null,
    choiceRow ? { field: "bf-summon-choice", why: `pick ${lower(choiceRow.ask)} first` } : null
  ].filter(Boolean);
  await openPicker(message, SUMMON_FLAG, caster, {
    title: `${flag.itemName} — ${flag.sourceName}`, icon: "fa-solid fa-spaghetti-monster-flying", width: 480,
    card: { eyebrow: "Summon", title: flag.itemName, subtitle: flag.level ? `level ${flag.level}` : "" },
    sections, needs: asked,
    buttons: [
      { action: "place", label: "Place", default: true, checks: true, submit: picks => {
        const profile = flag.profiles.find(p => p.id === picks.one("bf-summon-profile")) ?? flag.profiles[0];
        const pickRow = pool.find(r => r.uuid === picks.one("bf-summon-pick")) ?? null;
        const creatureType = picks.one("bf-summon-type");
        const creatureSize = picks.one("bf-summon-size");
        void (async () => {
          try {
            const count = await countOf(flag, profile);
            const usePool = poolPicks(profile, flag.mode);
            const placements = await pickSpots({ originToken: casterToken(flag), actorUuid: usePool ? pickRow.uuid : profile.uuid, count,
              rangeFt: flag.rangeFt ?? null, label: usePool ? pickRow.name : (profile.label || profile.name || "the creature") });
            if ( !placements.length ) return;   // cancelled on the map: the card's button recalls the popup
            await answerPlacement(message, flag, { profileId: profile.id, pick: pickRow ? { uuid: pickRow.uuid, name: pickRow.name, img: pickRow.img } : null,
              choice: picks.one("bf-summon-choice"), placements, count, sceneId: canvas.scene?.id ?? flag.sceneId ?? null,
              creatureSize: needs.size ? creatureSize : (sizes[0] ?? null), creatureType: needs.type ? creatureType : (types[0] ?? null) });
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

/* --- the elect lands it ---------------------------------------------------------------------------- */

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
    for ( const placement of flag.placements ?? [] ) {
      // dnd5e's own changes for the profile, per token (a formula may be dice).
      const changes = await activity.getChanges(actor, profile, options);
      const narrowed = (row && flag.picked) ? narrowingUpdate(actor, row, flag.picked) : null;
      if ( narrowed ) {
        // ⚠ A token delta's item entry is merged as nested data; a dotted key would be stored as a literal key.
        const nested = foundry.utils.expandObject(narrowed);
        const have = changes.actorUpdates.items.find(i => i._id === narrowed._id);
        if ( have ) foundry.utils.mergeObject(have, nested); else changes.actorUpdates.items.push(nested);
      }
      tokensData.push(await activity.getTokenData({ actor, placement: { ...placement }, tokenUpdates: changes.tokenUpdates, actorUpdates: changes.actorUpdates }));
    }
    const created = await scene.createEmbeddedDocuments("Token", tokensData, { dnd5e: { autoRollNPCHP: "no" } });
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
    const byScene = new Map();
    for ( const l of flag.landed ?? [] ) byScene.set(l.sceneId, [...(byScene.get(l.sceneId) ?? []), l.tokenId]);
    for ( const [sceneId, ids] of byScene ) {
      const scene = game.scenes.get(sceneId);
      const live = ids.filter(id => scene?.tokens.get(id));
      if ( live.length ) await scene.deleteEmbeddedDocuments("Token", live);
    }
    const caster = resolveUuid(flag.sourceUuid);
    const effect = flag.resistance?.effectId ? caster?.effects?.get(flag.resistance.effectId) : null;
    if ( effect ) await effect.delete();
  } catch(err) {
    console.error(`${TITLE} | The summon could not be dismissed — delete the token by hand.`, err);
  } finally {
    await queueFlagWrite(message, SUMMON_FLAG, current => { current.dismissed = true; current.dismissing = false; current.dismissedAt = Date.now(); });
  }
}

registerResumable(SUMMON_FLAG, {
  pending: flag => (flag?.status === "placed") && ((!flag.applied && !flag.applying) || (flag.applied && flag.dismissAsked && !flag.dismissed && !flag.dismissing)),
  drives: () => isActiveGM(),
  drive: async message => {
    const flag = readFlag(message, SUMMON_FLAG);
    if ( flag?.applied ) await dismissSummon(message); else await landSummon(message);
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

/* --- the card says it (R5) --------------------------------------------------------------------------- */

function drawSummon(message, html, flag) {
  const row = document.createElement("div");
  row.className = "bythebooks-summon";
  const caster = resolveUuid(flag.sourceUuid);
  const mine = canAnswerFor(caster);
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
    row.innerHTML = bfCard({ eyebrow: "Summon", tone: "neutral", title: `${what} — dismissed`, subtitle: flag.resistance ? `${flag.resistance.effectName} ended` : "" });
  } else if ( flag.outcome === "failed" ) {
    row.innerHTML = bfCard({ eyebrow: "Summon", tone: "bad", title: `${what} — could not be landed`, subtitle: `${flag.failure ?? "see the console"} · place it by hand` });
  } else {
    const kind = flag.creatureType ? (CONFIG.DND5E?.creatureTypes?.[flag.creatureType]?.label ?? flag.creatureType) : null;
    row.innerHTML = bfCard({ eyebrow: "Summon", tone: "good", title: `${names.join(", ") || what} — summoned`,
      subtitle: [kind, flag.picked, flag.resistance ? `${flag.resistance.effectName} on ${flag.sourceName}` : null,
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
