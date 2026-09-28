/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE RAY TABLE (RAY_TABLES) — a cone whose text rolls a die per
 * creature to pick its ray (Prismatic Spray). The cast's own demand is closed as its card is born; once the
 * cone stands (the cast's placement, or a region placed after), the caster's driver rolls the die per
 * creature inside and raises ONE saves demand per (creature, ray): a damage ray against the Cast's save with
 * the ray's type forced onto the roll, a condition ray against the ray's own save activity, its effect landed
 * on a failure by this machine (the pack ties both effects to the Cast). The cone is instantaneous and goes
 * with the rays. Rulings: RULINGS *The spells slice — the held spells*.
 */
import { MODULE_ID, TITLE, drivesMomentFor, statContext, decisionWindow, queueFlagWrite, canApplyTo, whisperNoGM } from "./core.js";
import { activityNamed, cardActivity, lower, resolveUuid } from "./lookup.js";
import { RAY_TABLES, tableIndex, rayTableEntries, listedNames } from "./decide/registry.js";
import { raysFor, rayWords, raySummaryLines, rayVerdict } from "./decide/prismatic.js";
import { saveDemandData, saveTargetEntry } from "./decide/demand.js";
import { CARD, activityUuidOf, castLevelOn, isCard } from "./decide/card.js";
import { bfCard, esc, ruleLine } from "./decide/present.js";
import { tokensInRegions } from "./geometry.js";
import { isDeadForSaves } from "./decide/eligible.js";
import { rollDamageForSave } from "./auto-damage.js";
import { applyEffectsWithReceipt } from "./effect-riders.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const SPRAY_FLAG = "prismatic";
const RAY_FLAG = "prismaticRay";
const { rowFor } = tableIndex(RAY_TABLES);
const listed = () => listedNames(rayTableEntries());

/** The listed row this activity is the CAST of, or null. */
function castRowOf(activity) {
  const row = activity?.item ? rowFor(activity.item) : null;
  if ( !row || !listed().has(lower(row.key)) ) return null;
  return (activity.type === "save") && (lower(activity.name) === lower(row.cast)) ? row : null;
}

/* --- the birth: the cast's own demand is closed before the saves machine stamps it ---------------- */

listen("preCreateChatMessage", "prismatic", doc => {
  try {
    if ( !isCard(doc, CARD.usage) || doc.getFlag?.(MODULE_ID, SPRAY_FLAG) ) return;
    const activity = resolveUuid(activityUuidOf(doc));
    const row = castRowOf(activity);
    if ( !row ) return;
    const dc = activity.save?.dc?.value;
    const abilities = [...(activity.save?.ability ?? [])];
    const caster = activity.actor ?? null;
    doc.updateSource({ flags: { [MODULE_ID]: {
      // A closed demand: nothing asked at the cast, the area adoption never fills it, the rays are the machine's.
      saves: saveDemandData({ status: "done", stat: statContext(caster?.uuid ?? null), abilities, dc: Number(dc) || 0, damageOnSave: "half", hasDamage: false,
        effectNames: { fail: [], always: [] }, effectsHandled: "prismatic", pinnedTargets: true, activityUuid: activity.uuid,
        templateType: activity.target?.template?.type ?? null, templated: true, durationUnits: "inst",
        item: { name: activity.item.name, img: activity.item.img ?? null }, casterName: caster?.name ?? null, targets: [] }),
      [SPRAY_FLAG]: { ...statContext(caster?.uuid ?? null), key: row.key, status: "pending", activityUuid: activity.uuid }
    } } });
  } catch(err) { console.warn(`${TITLE} | The ray table could not close the cast's demand — the cast asks as the pack has it.`, err); }
});

/* --- the cone: the placement, or a region placed after, starts the rays ----------------------------- */

listen("dnd5e.postUseActivity", "prismatic", (activity, _usageConfig, results) => {
  try {
    if ( !castRowOf(activity) ) return;
    const card = (results?.message instanceof ChatMessage) ? results.message : null;
    const regions = (results?.templates ?? []).flat().filter(r => r?.parent);
    if ( card && regions.length ) void spray(card, regions);
  } catch(err) { console.error(`${TITLE} | The ray table failed at the cast — roll the rays by hand.`, err); }
});

listen("createRegion", "prismatic", region => {
  try {
    const activityUuid = region?.getFlag?.("dnd5e", "activity");
    if ( !activityUuid ) return;
    const card = game.messages.contents.filter(m => {
      const p = m.getFlag(MODULE_ID, SPRAY_FLAG);
      return (p?.status === "pending") && (p.activityUuid === activityUuid);
    }).at(-1);
    if ( card ) void spray(card, [region]);
  } catch(err) { console.error(`${TITLE} | The ray table failed at the placement — roll the rays by hand.`, err); }
});

const spraying = new Set();

/** The rays: one claim on the card, a die per creature inside, a demand per ray, the cone swept. */
async function spray(card, regions) {
  const p = card.getFlag(MODULE_ID, SPRAY_FLAG);
  if ( (p?.status !== "pending") || !drivesMomentFor(p.sourceUuid ?? null) ) return;
  if ( spraying.has(card.id) ) return;
  spraying.add(card.id);
  try {
    const activity = cardActivity(card, p.activityUuid);
    const row = castRowOf(activity);
    if ( !row ) return;
    const caster = activity.actor ?? null;
    const casterTok = caster?.token ?? caster?.getActiveTokens?.(true, true)?.[0] ?? null;
    // A dead creature stays out; an unresolvable uuid stays in (never eat a demand on a lookup miss).
    const alive = c => { const a = resolveUuid(c.uuid); return !(a instanceof Actor) || !isDeadForSaves(a); };
    const inside = (tokensInRegions(regions) ?? []).filter(c => (c.uuid !== caster?.uuid) && (c.tokenId !== casterTok?.id)).filter(alive);
    let claimed = false;
    await queueFlagWrite(card, SPRAY_FLAG, current => {
      if ( current.status !== "pending" ) return false;
      current.status = "rolled";
      claimed = true;
    });
    if ( !claimed ) return;
    // The dice, rolled ahead per creature (a pool of the draw cap) and fed to the pure draw face by face.
    const CAP = 12;
    const rolls = [];
    const entries = [];
    for ( const c of inside ) {
      const pool = await new Roll(`${CAP}d${row.die}`).evaluate();
      const faces = (pool.dice?.[0]?.results ?? []).map(r => Number(r.result));
      let i = 0;
      const { rays, faces: drawn } = raysFor(row, () => faces[i++] ?? 0, { cap: CAP });
      rolls.push(pool);
      entries.push({ ...c, rays, faces: drawn });
    }
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterTok ?? undefined }),
      rolls,
      content: bfCard({ img: activity.item.img ?? null, eyebrow: `${row.key} — the rays`, tone: "bad",
        title: entries.length ? `${row.key} — ${entries.length} creature${entries.length === 1 ? "" : "s"} in the cone` : `${row.key} — nobody in the cone`,
        subtitle: entries.length ? `a d${row.die} per creature (the pool's first faces); an ${row.twice} is two rays` : "the cone found no creature",
        lines: [...raySummaryLines(entries).map(esc), ruleLine(row.rule)] }),
      flags: { [MODULE_ID]: { prismaticRays: { ...statContext(caster?.uuid ?? null), key: row.key, castCard: card.id,
        entries: entries.map(e => ({ uuid: e.uuid, name: e.name, faces: e.faces, rays: e.rays.map(r => r.colour) })) } } }
    });
    const spellLevel = castLevelOn(card) ?? activity.item.system?.level ?? null;
    for ( const e of entries ) {
      for ( const ray of e.rays ) await raiseRay({ row, activity, caster, casterTok, card, target: e, ray, spellLevel });
    }
    // Instantaneous: the cone goes with its rays (the region is the placer's or the GM's to delete).
    for ( const region of regions ) {
      if ( region.parent?.regions?.get(region.id) && region.canUserModify?.(game.user, "delete") ) await region.delete().catch(() => {});
    }
  } catch(err) {
    console.error(`${TITLE} | The rays could not be raised — roll them by hand.`, err);
  } finally {
    spraying.delete(card.id);
  }
}

/** One ray's demand: the Cast's save with the type forced (a damage ray), or the ray's own save (a condition ray). */
async function raiseRay({ row, activity, caster, casterTok, card, target, ray, spellLevel }) {
  try {
    const item = activity.item;
    const save = ray.save ? activityNamed(item, ray.save) : activity;
    const dc = save?.save?.dc?.value;
    const abilities = [...(save?.save?.ability ?? [])];
    if ( !save || !(dc > 0) || !abilities.length ) { console.warn(`${TITLE} | ${row.key}: no save for the ${ray.colour} ray — ask for it by hand.`); return; }
    const hasDamage = !!ray.type && !!activity.damage?.parts?.length;
    const window = decisionWindow();
    const words = rayWords({ spell: row.key, ray, target: target.name, caster: caster?.name ?? null });
    const abilityLabel = CONFIG.DND5E.abilities[abilities[0]]?.label ?? abilities[0];
    const scaling = Math.max(0, Number(spellLevel ?? 0) - Number(item.system?.level ?? 0));
    const demand = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterTok ?? undefined }),
      content: bfCard({ img: item.img ?? null, eyebrow: words.eyebrow, tone: "bad", title: words.title,
        subtitle: `${words.subtitle} · ${abilityLabel} save DC ${dc}`, lines: [ruleLine(row.rule)] }),
      flags: { [MODULE_ID]: {
        saves: saveDemandData({
          stat: statContext(caster?.uuid ?? null), abilities, dc, damageOnSave: "half", hasDamage,
          effectNames: { fail: [], always: [] }, effectsHandled: "prismatic",
          // ⚠ Pinned: the cast's activity is shared with every damage ray; the area adoption must not rewrite the targets.
          pinnedTargets: true,
          demand: { spell: true, abilities, statuses: ray.effect ? [...(item.effects.find(e => lower(e.name) === lower(ray.effect))?.statuses ?? [])] : [], sleep: false },
          activityUuid: save.uuid, templateType: null, templated: false, durationUnits: "inst",
          item: { name: item.name, img: item.img ?? null }, casterName: caster?.name ?? null, scaling,
          window, deadline: window ? Date.now() + (window * 1000) : null,
          targets: [saveTargetEntry(target.uuid, target.name)]
        }),
        [RAY_FLAG]: { ...statContext(caster?.uuid ?? null), key: row.key, face: ray.face, colour: ray.colour, type: ray.type ?? null,
          effect: ray.effect ?? null, save: ray.save ?? null, targetUuid: target.uuid, targetName: target.name, castCard: card.id, castActivity: activity.uuid, spellLevel }
      } }
    });
    if ( hasDamage && demand ) await rollDamageForSave(activity, demand);
  } catch(err) {
    console.error(`${TITLE} | The ${ray?.colour ?? ""} ray could not be demanded — ask for the save by hand.`, err);
  }
}

// A damage ray's roll wears the ray's type: the part offers five, the die picked one.
listen("dnd5e.preRollDamage", "prismatic", (config, _dialog, message) => {
  try {
    const originId = message?.data?.system?.origin ?? null;
    const card = originId ? game.messages.get(originId) : null;
    const ray = card?.getFlag(MODULE_ID, RAY_FLAG);
    if ( !ray?.type ) return;
    for ( const roll of config.rolls ?? [] ) {
      const offered = [...(roll.options?.types ?? [])].map(t => String(t).toLowerCase());
      if ( offered.includes(ray.type) || !offered.length ) { roll.options ??= {}; roll.options.type = ray.type; }
    }
  } catch(err) { console.warn(`${TITLE} | The ray's type could not be set — the roll wears the pack's first.`, err); }
});

/* --- the verdict of a condition ray: the effect on a failure, landed by this machine ---------------- */

const settling = new Set();
async function settleRay(card) {
  const ray = card.getFlag(MODULE_ID, RAY_FLAG);
  if ( !ray || ray.settled ) return;
  const flag = card.getFlag(MODULE_ID, "saves");
  const entry = flag?.targets?.find(t => t.uuid === ray.targetUuid);
  if ( !entry?.done || !drivesMomentFor(flag.sourceUuid ?? null) ) return;
  if ( settling.has(card.id) ) return;
  settling.add(card.id);
  try {
    let claimed = false;
    await queueFlagWrite(card, RAY_FLAG, current => {
      if ( current.settled ) return false;
      current.settled = true;
      claimed = true;
    });
    if ( !claimed ) return;
    const verdict = rayVerdict({ colour: ray.colour, type: ray.type, effect: ray.effect }, entry.outcome);
    let landed = "";
    if ( verdict.lands ) {
      const activity = resolveUuid(ray.castActivity);
      const item = activity?.item ?? null;
      const effect = item?.effects?.find(e => lower(e.name) === lower(verdict.lands)) ?? null;
      const target = resolveUuid(ray.targetUuid);
      if ( !effect ) landed = " (the pack's effect was not found — apply it by hand)";
      else if ( !(target instanceof Actor) || !canApplyTo(target) ) { landed = " — no GM: apply it by hand"; await whisperNoGM(`${ray.key}'s ${verdict.lands} on ${ray.targetName}`); }
      else await applyEffectsWithReceipt(card, [effect], [{ uuid: target.uuid, name: ray.targetName }],
        { source: flag.sourceUuid ?? null, activity, spellLevel: ray.spellLevel ?? undefined, scaling: Number(flag.scaling ?? 0) });
    }
    await queueFlagWrite(card, RAY_FLAG, current => { current.outcome = entry.outcome; current.says = `${verdict.says}${landed}`; });
  } catch(err) {
    console.error(`${TITLE} | The ray's verdict could not land — apply its effect by hand.`, err);
  } finally {
    settling.delete(card.id);
  }
}

listen("updateChatMessage", "prismatic", message => { void settleRay(message); });

listen("dnd5e.renderChatMessage", "prismatic", (message, html) => {
  try {
    const ray = message.getFlag(MODULE_ID, RAY_FLAG);
    if ( !ray ) return;
    void settleRay(message);   // the reload-resume twin of the update watcher
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !ray.says || !content || content.querySelector(".bf-ray-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-ray-line";
    div.style.cssText = `margin:0.25rem 0;font-size:var(--font-size-11,11px);font-weight:bold;opacity:0.9;color:${ray.outcome === "saved" ? "var(--dnd5e-color-blue, #3a7ca5)" : "var(--dnd5e-color-maroon, #740b0b)"};`;
    div.innerHTML = `<i class="fa-solid fa-rainbow"></i> ${esc(ray.says)}`;
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The ray's line could not render.`, err); }
});
