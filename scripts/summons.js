/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): SUMMONS (issue #1) — the player casts and places, the
 * active GM's client makes the creature. dnd5e's summon activity places only for a user who holds
 * Create Token (and Create Actor for a compendium import) in a world with Allow Summoning on, and its
 * dialog cannot ask what a spell's own text asks (the dragon's damage type). Here the system's placement
 * is switched off for every summon activity with a profile; the caster's client asks everything in ONE
 * popup off the cast card (the form rows ruled C, RULINGS *Summons*; the shared gallery is gallery.js),
 * runs the placement preview (no permission needed) and writes the record on its own card; the elect
 * fetches or imports the creature with its own permissions, applies dnd5e's own profile changes, narrows
 * the dragon's breath, creates the tokens as dependents of the concentration effect, seats them right
 * after the caster, grants the caster's players ownership, lands the shared resistance on the caster, and
 * stamps `applied`. With no GM online the card holds and says so (DESIGN §4). Dismiss deletes what the
 * elect made.
 */
import { MODULE_ID, TITLE, activeCombatFor, isActiveGM, queueFlagWrite, canAnswerFor, statContext } from "./core.js";
import { cardActivity, lower, resolveUuid } from "./lookup.js";
import { SUMMON_CHOICES, summonChoiceEntries, listedNames } from "./decide/registry.js";
import { profileRows, choiceRowKey, formNeeds, summonRecord, placedAnswer, narrowedActivities, resistanceEffectData,
  ownershipGrant, seatInitiative } from "./decide/summons.js";
import { bfCard, esc, popupKey, ruleLine } from "./decide/present.js";
import { concentrationIdOf } from "./decide/card.js";
import { effectRecord, joinEffectReceipt } from "./decide/receipt.js";
import { formRowHTML, poolFromPacks, poolListHTML, previewPlacement, statsRight, summaryOf, wireGallerySearch } from "./gallery.js";
import { openMomentPopup, momentButton, registerResumable, shownMoments } from "./ui.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const SUMMON_FLAG = "summon";
const listed = () => listedNames(summonChoiceEntries());

/** A summon activity the module takes off the system's hands: one with a profile the cast may use. */
const takes = activity => (activity?.type === "summon") && !!activity.availableProfiles?.length;

/* --- the intercept: the system places nothing ---------------------------------------------------- */

listen("dnd5e.preUseActivity", "summons", (activity, usageConfig) => {
  try {
    if ( !takes(activity) ) return;
    usageConfig.create ??= {};
    usageConfig.create.summons = false;
  } catch(err) { console.warn(`${TITLE} | Could not switch the system's summoning off.`, err); }
});

/* --- the record on the cast card ------------------------------------------------------------------ */

/** A form row's label, art and lines, read off the creature it names (a compendium read, no permission). */
async function describeProfile(row) {
  const out = { ...row, label: row.name || "", img: null, summary: summaryOf(null) };
  if ( !row.uuid ) { out.label ||= `a creature of CR ${row.cr ?? "?"}${row.types.length ? ` (${row.types.join(", ")})` : ""}`; return out; }
  try {
    const actor = await fromUuid(row.uuid);
    if ( actor ) {
      out.label ||= actor.name;
      out.img = actor.prototypeToken?.texture?.src ?? actor.img ?? null;
      out.summary = summaryOf(actor);
    }
  } catch { /* the row keeps its name */ }
  return out;
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
    concentrationId: concentrationIdOf(message), sceneId: tok?.parent?.id ?? canvas.scene?.id ?? null
  });
  record.creatureSizes = [...(activity.creatureSizes ?? [])];
  record.creatureTypes = [...(activity.creatureTypes ?? [])];
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

/** The spell's own choice as pills. */
function choiceHTML(key) {
  const row = SUMMON_CHOICES[key];
  if ( !row ) return "";
  const label = o => CONFIG.DND5E?.damageTypes?.[o]?.label ?? o;
  return `<div style="margin-top:0.5rem;"><b>${esc(row.ask)}</b></div>
    <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin:0.3rem 0;">${row.options.map(o =>
      `<label style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.15rem 0.5rem;border:1px solid var(--color-border-dark,#0006);border-radius:12px;cursor:pointer;"><input type="radio" name="bf-summon-choice" value="${esc(o)}" style="margin:0;">${esc(label(o))}</label>`).join("")}</div>
    ${ruleLine(row.rule)}`;
}

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
  const flag = message.getFlag(MODULE_ID, SUMMON_FLAG);
  if ( flag?.status !== "asked" ) return;
  const caster = resolveUuid(flag.sourceUuid);
  if ( !caster ) return;
  const needs = formNeeds({ profiles: flag.profiles, choice: flag.choice });
  const poolProfile = flag.profiles.find(p => !p.uuid && (p.cr !== null)) ?? null;
  const pool = (needs.pool && poolProfile) ? await poolFromPacks(poolRuleOf(poolProfile)) : [];
  const lines = [];
  if ( needs.profile ) lines.push(`<div><b>The form</b> · ${flag.profiles.length} in the pack</div>${flag.profiles.map((p, i) => formRowHTML(p, { field: "bf-summon-profile", value: p.id, checked: i === 0, right: statsRight(p.summary) })).join("")}`);
  else if ( (flag.profiles.length === 1) && !needs.pool ) lines.push(formRowHTML(flag.profiles[0], { field: "bf-summon-profile", value: flag.profiles[0].id, checked: true, right: statsRight(flag.profiles[0].summary) }));
  if ( needs.pool ) lines.push(poolListHTML(pool, { field: "bf-summon-pick" }));
  if ( needs.choice ) lines.push(choiceHTML(flag.choice));
  if ( !needs.any ) lines.push("<em>Nothing to pick: place it.</em>");
  const dialog = await openMomentPopup(message, SUMMON_FLAG, caster, {
    title: `${flag.itemName} — ${flag.sourceName}`, icon: "fa-solid fa-spaghetti-monster-flying", width: 480,
    content: bfCard({
      eyebrow: "Summon", tone: "pending", title: flag.itemName,
      subtitle: `${flag.level ? `level ${flag.level} · ` : ""}the card posts the creature once it is placed; the GM's client lands it`,
      lines
    }),
    buttons: [
      { action: "place", label: "Place", default: true, callback: (_event, button) => {
        const form = button.form;
        const profileId = form.querySelector('input[name="bf-summon-profile"]:checked')?.value ?? flag.profiles[0]?.id ?? null;
        const profile = flag.profiles.find(p => p.id === profileId) ?? flag.profiles[0];
        const pickUuid = form.querySelector('input[name="bf-summon-pick"]:checked')?.value ?? null;
        const pickRow = pool.find(r => r.uuid === pickUuid) ?? null;
        const choice = form.querySelector('input[name="bf-summon-choice"]:checked')?.value ?? null;
        if ( needs.choice && !choice ) { ui.notifications?.warn(`${TITLE}: pick ${lower(SUMMON_CHOICES[flag.choice]?.ask ?? "the answer")} first.`); void showSummonPopup(message); return; }
        if ( needs.pool && !pickRow ) { ui.notifications?.warn(`${TITLE}: pick the creature first.`); void showSummonPopup(message); return; }
        void (async () => {
          try {
            const count = await countOf(flag, profile);
            const placements = await previewPlacement({ originToken: casterToken(flag), actorUuid: profile.uuid ?? pickRow.uuid, count });
            if ( !placements.length ) return;   // cancelled on the map: the card's button recalls the popup
            await answerPlacement(message, flag, { profileId: profile.id, pick: pickRow ? { uuid: pickRow.uuid, name: pickRow.name, img: pickRow.img } : null,
              choice, placements, count, sceneId: canvas.scene?.id ?? flag.sceneId ?? null,
              creatureSize: flag.creatureSizes?.[0] ?? null, creatureType: flag.creatureTypes?.[0] ?? null });
          } catch(err) {
            console.error(`${TITLE} | The summon could not be placed — place the creature by hand.`, err);
            ui.notifications?.error(`${TITLE}: the summon could not be placed (${err?.message ?? err}).`);
          }
        })();
      } },
      { action: "cancel", label: "Not now" }
    ]
  });
  wireGallerySearch(dialog?.element ?? null);
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
  const flag = message.getFlag(MODULE_ID, SUMMON_FLAG);
  const landed = [];
  let outcome = "landed";
  let failure = null;
  let resistance = null;
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
      const narrowed = (row && flag.choice) ? narrowingUpdate(actor, row, flag.choice) : null;
      if ( narrowed ) {
        const have = changes.actorUpdates.items.find(i => i._id === narrowed._id);
        if ( have ) Object.assign(have, narrowed); else changes.actorUpdates.items.push(narrowed);
      }
      const data = await activity.getTokenData({ actor, placement: { ...placement }, tokenUpdates: changes.tokenUpdates, actorUpdates: changes.actorUpdates });
      if ( concentration ) foundry.utils.setProperty(data, "flags.dnd5e.dependentOn", concentration.uuid);
      tokensData.push(data);
    }
    const created = await scene.createEmbeddedDocuments("Token", tokensData, { dnd5e: { autoRollNPCHP: "no" } });
    for ( const t of created ) landed.push({ tokenId: t.id, sceneId: scene.id, actorUuid: t.actor?.uuid ?? null, name: t.name });
    Hooks.callAll("dnd5e.postSummon", activity, profile, created, options);
    // The caster's players own what they summoned.
    const grant = ownershipGrant(caster.ownership ?? {}, actor.ownership ?? {});
    if ( grant ) await actor.update({ ownership: { ...(actor._source?.ownership ?? {}), ...grant } });
    // The seat: right after the caster, on the caster's Initiative.
    const combat = activeCombatFor(caster);
    if ( combat ) {
      const initiative = seatInitiative(combat.getCombatantsByActor(caster)[0]?.initiative ?? null);
      await combat.createEmbeddedDocuments("Combatant", created.map(t => ({ tokenId: t.id, sceneId: scene.id, actorId: t.actorId, initiative })));
    }
    // The shared resistance on the caster, for the spell's life.
    if ( row?.resist && flag.choice ) {
      const label = CONFIG.DND5E?.damageTypes?.[flag.choice]?.label ?? flag.choice;
      const data = resistanceEffectData({ type: flag.choice, name: `${row.resist} (${label})`, img: activity.item.img, origin: activity.item.uuid, description: row.says ?? "" });
      data.duration = concentration ? { ...(concentration._source?.duration ?? {}) } : (activity.duration?.getEffectData?.() ?? {});
      if ( concentration ) foundry.utils.setProperty(data, "flags.dnd5e.dependentOn", concentration.uuid);
      const [effect] = await caster.createEmbeddedDocuments("ActiveEffect", [data]);
      if ( effect ) resistance = { uuid: caster.uuid, name: caster.name, img: caster.img ?? null, effectId: effect.id, effectName: effect.name, effectImg: effect.img ?? null, description: data.description };
    }
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
    });
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
  const flag = message.getFlag(MODULE_ID, SUMMON_FLAG);
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
    const flag = message.getFlag(MODULE_ID, SUMMON_FLAG);
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

/* --- the card says it (R5) --------------------------------------------------------------------------- */

function drawSummon(message, html, flag) {
  const row = document.createElement("div");
  row.className = "battleflow-summon";
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
      subtitle: gm ? "waiting for the GM's client to land it" : "no GM online — it lands when a GM connects" });
  } else if ( flag.dismissed ) {
    row.innerHTML = bfCard({ eyebrow: "Summon", tone: "neutral", title: `${what} — dismissed`, subtitle: flag.resistance ? `${flag.resistance.effectName} ended` : "" });
  } else if ( flag.outcome === "failed" ) {
    row.innerHTML = bfCard({ eyebrow: "Summon", tone: "bad", title: `${what} — could not be landed`, subtitle: `${flag.failure ?? "see the console"} · place it by hand` });
  } else {
    row.innerHTML = bfCard({ eyebrow: "Summon", tone: "good", title: `${names.join(", ") || what} — landed by the GM's client`,
      subtitle: [flag.choice, flag.resistance ? `${flag.resistance.effectName} on ${flag.sourceName}` : null, `${flag.sourceName}'s players own it`].filter(Boolean).join(" · ") });
    if ( (mine || game.user.isGM) && !flag.dismissAsked ) row.appendChild(momentButton("Dismiss", () => { void askDismiss(message); }, { margin: "0.25rem 0 0" }));
    else if ( flag.dismissAsked ) row.appendChild(Object.assign(document.createElement("em"), { textContent: "dismissing…" }));
  }
  html.querySelector(SURFACES.messageContent)?.appendChild(row);
}

listen("dnd5e.renderChatMessage", "summons", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, SUMMON_FLAG);
    if ( flag ) drawSummon(message, html, flag);
  } catch(err) {
    console.error(`${TITLE} | The summon's row could not be drawn.`, err);
  }
});

listen("ready", "summons", () => {
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = Object.assign(mod.api ?? {}, { summons: { showSummonPopup, askDismiss } });
});
