/**
 * Battle Flow — the hit menu (RULINGS *The hit menu*): on a hit, the options the sheet grants are
 * offered before the dice, grouped by the feature that pays; the die rides the roll, the pool is
 * spent, a save goes through the saves machine.
 */
import { MODULE_ID, TITLE, canAnswerFor, canApplyTo, drivesMomentFor, queueFlagWrite, statContext, decisionWindow } from "./core.js";
import { ruleHTML } from "./rule-text.js";
import { verdictsOn } from "./decide/demand.js";
import { featureNamed, activityOfType, namesAnswering, profileEffects, resolveUuid, resolveDie } from "./lookup.js";
import { hitMenuEntries } from "./decide/registry.js";
import { forceStatus, hitTargets, poolOf, spendSuperiorityDie, statSourceOf, withTargets } from "./shared.js";
import { bfCard, hitMenuHTML, momentBarHTML, popupKey, ruleLine, spendPhrase } from "./decide/present.js";
import { HIT_GROUPS, HIT_OPTIONS, answers } from "./decide/registry.js";
import { hitMenu, hitPick, picksOf, sweepVerdict } from "./decide/hit-menu.js";
import { riderPartFormula } from "./decide/clock.js";
import { effectRecord, joinEffectReceipt } from "./decide/receipt.js";
import { nearestFeet, tokenForUuid, tokenOfActor } from "./geometry.js";
import { attackMessageForDamage, registerOfferPart } from "./auto-damage.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { applyActivityEffectsOnHit, applyEffectsWithReceipt, messageActivity } from "./effect-riders.js";
import { armDeadline, disarmDeadline, momentButton, openMomentPopup, registerRelay, registerResumable, shownMoments } from "./ui.js";
import { SURFACES } from "./surfaces.js";
import { listen, listenOnce } from "./dispatch.js";

/*
 * Four parts (rows: decide/registry.js HIT_GROUPS / HIT_OPTIONS): THE OFFER writes the picks on the
 * attack message before the dice; THE RIDER adds the die and spends the pool (roller's client);
 * THE CONSEQUENCES put the save through the saves machine, pressing an unlinked condition on the
 * failure; THE SWEEP rolls the die apart at a second creature. `picksOf` is the one reader of picks.
 */

/** The die behind an option — its damage activity's first part, resolved on the sheet. "d8" reads as "1d8". */
function dieFormulaOf(actor, activity) {
  const part = activity?.damage?.parts?.[0];
  const raw = part ? riderPartFormula({ number: part.number, denomination: part.denomination, custom: part.custom, bonus: part.bonus }) : null;
  return resolveDie(actor, raw);
}

/** The feature names the menu's groups and options answer to. */
const MENU_FEATURES = [...Object.values(HIT_GROUPS).map(g => g.feature), ...Object.values(HIT_OPTIONS).map(r => r.feature)].filter(Boolean);

/** The menu for this hit, and the sheet facts behind every row. */
function menuFor(attackMessage, activity) {
  const attacker = activity?.actor ?? attackMessage?.getAssociatedActor();
  const item = activity?.item;
  if ( !attacker || !item ) return null;
  const listed = hitMenuEntries().map(e => e.kind);
  if ( !listed.length ) return null;
  const features = namesAnswering(attacker.items.filter(i => i.type === "feat"), MENU_FEATURES);
  const edge = {};
  const pools = {};
  const fits = {};
  const hits = attackMessage ? hitTargets(attackMessage) : [];
  for ( const [gkey, group] of Object.entries(HIT_GROUPS) ) {
    // A group with no paying feature (a text-only parent) requires nothing.
    if ( group.feature && !featureNamed(attacker, group.feature) ) continue;
    const perOption = group.pool === "option";
    for ( const [key, row] of Object.entries(HIT_OPTIONS) ) {
      if ( row.group !== gkey ) continue;
      const feat = featureNamed(attacker, row.feature);
      const die = feat ? activityOfType(feat, "damage") : null;
      // A no-save press ships a utility activity and no die — its uses are the cost.
      const paying = die ?? ((feat && row.press) ? activityOfType(feat, "utility") : null);
      if ( !feat || !paying ) continue;
      const pool = poolOf(attacker, paying);
      const formula = die ? dieFormulaOf(attacker, die) : null;
      // An option-pool group's damage type is the boon's own. ⚠ Only there: a maneuver's die part
      // lists several types (the die takes the weapon's), and its first is arbitrary.
      const partType = (die && perOption) ? ([...(die.damage?.parts?.[0]?.types ?? [])][0] ?? null) : null;
      edge[key] = { item: feat, dieActivity: die, saveActivity: activityOfType(feat, "save"), pool, formula, type: partType };
      if ( perOption ) pools[key] = pool ? { left: Number(pool.system?.uses?.value ?? 0), max: Number(pool.system?.uses?.max ?? 0), die: formula, type: partType } : null;
      else {
        pools[gkey] ??= pool ? { left: Number(pool.system?.uses?.value ?? 0), die: formula } : null;
        if ( pools[gkey] && !pools[gkey].die && formula ) pools[gkey].die = formula;
      }
      if ( row.maxSize ) fits[key] = sizeFits(hits, row.maxSize);
    }
  }
  const melee = activity.attack?.type?.value !== "ranged";
  const menu = hitMenu({ groups: HIT_GROUPS, options: HIT_OPTIONS, listed, features, melee, pools, fits });
  const type = [...(item.system?.damage?.base?.types ?? [])][0] ?? null;
  return { attacker, menu, edge, type };
}

/** Does every hit target fit `maxSize`? null when a size cannot be read (the table judges). */
function sizeFits(hits, maxSize) {
  const sizes = CONFIG.DND5E?.actorSizes ?? {};
  const cap = sizes[maxSize]?.numerical;
  if ( !Number.isFinite(cap) || !hits.length ) return null;
  let unknown = false;
  for ( const h of hits ) {
    const size = fromUuidSync(h.uuid)?.system?.traits?.size;
    const n = sizes[size]?.numerical;
    if ( !Number.isFinite(n) ) { unknown = true; continue; }
    if ( n > cap ) return false;
  }
  return unknown ? null : true;
}

/**
 * ⚠ The pack ships some target-facing effects (Goaded) with `transfer: true`, so they land on the
 * WIELDER; the owner corrects the flag on their item copy at ready and when the item lands.
 */
async function targetFacingEffects(row, item) {
  const out = [];
      // An activity's list holds PROFILES whose effects resolve asynchronously (lookup.js).
  if ( row.save ) for ( const { effect } of await profileEffects(activityOfType(item, "save")?.effects) ) if ( effect ) out.push(effect);
  if ( row.effects ) for ( const { effect } of await profileEffects(activityOfType(item, "damage")?.effects) ) if ( effect ) out.push(effect);
  if ( row.onFail ) { const e = item.effects.find(x => x.statuses?.has?.(row.onFail)); if ( e ) out.push(e); }
  return out;
}

/** The compendium's copy of an item: its recorded source, else a same-name pack item, SRD last. */
async function compendiumCopyOf(item) {
  const src = item?._stats?.compendiumSource;
  if ( src ) { const doc = await fromUuid(src).catch(() => null); if ( doc ) return doc; }
  const packs = game.packs.filter(p => (p.documentName === "Item") && !p.collection.startsWith("dnd5e."))
    .concat(game.packs.filter(p => (p.documentName === "Item") && p.collection.startsWith("dnd5e.")));
  for ( const pack of packs ) {
    const entry = pack.index.find(e => e.name === item.name);
    if ( !entry ) continue;
    const doc = await pack.getDocument(entry._id).catch(() => null);
    if ( doc ) return doc;
  }
  return null;
}

async function repairTransferEffects(actor) {
  if ( !actor?.isOwner ) return;
  for ( const row of Object.values(HIT_OPTIONS) ) {
    const item = featureNamed(actor, row.feature);
    if ( !item ) continue;
    for ( const effect of await targetFacingEffects(row, item) ) {
      if ( !effect.transfer ) continue;
      try {
        await effect.update({ transfer: false });
        // biome-ignore lint/suspicious/noConsole: tells the GM's console the item's data was corrected
        console.info(`${TITLE} | ${actor.name}'s ${item.name}: "${effect.name}" is a target's effect the pack flagged as the wielder's passive — corrected on the sheet.`);
      } catch(err) {
        console.warn(`${TITLE} | Could not correct ${item.name}'s "${effect.name}" on ${actor.name}.`, err);
      }
    }
  }
}

// The elect repairs each sheet once: the active GM, or with none the actor's own player.
listenOnce("ready", "hit-menu", () => {
  if ( !hitMenuEntries().length ) return;
  for ( const actor of game.actors ) {
    if ( drivesMomentFor(actor.uuid) ) void repairTransferEffects(actor);
  }
});
listen("createItem", "hit-menu", (item, _options, userId) => {
  if ( (userId !== game.user.id) || !(item.parent instanceof Actor) || (item.type !== "feat") ) return;
  if ( Object.values(HIT_OPTIONS).some(r => answers(r.feature, item)) ) void repairTransferEffects(item.parent);
});

/* --- the offer: a group per paying feature, one pick per group ------------------------------ */

registerOfferPart({
  key: "hitMenu",
  /** An affordable row is a decision pending: the offer opens whatever the auto-damage setting. */
  due: (attackMessage, activity) => {
    try { return !!menuFor(attackMessage, activity)?.menu.groups.some(g => g.rows.some(r => r.affordable)); }
    catch { return false; }
  },
  parts: (attackMessage, activity) => {
    const read = menuFor(attackMessage, activity);
    if ( !read?.menu.groups.length ) return null;
    const { menu, edge, type } = read;
    const chosen = new Set();
    // An option-pool group counts USES, a shared pool DICE.
    const leftTag = g => g.perOption
      ? (g.left > 0 ? `${g.left} ${g.left === 1 ? g.dieLabel : `${g.dieLabel}s`} left` : `no ${g.dieLabel}s left`)
      : (g.left > 0 ? `${g.left} × ${g.die ?? "die"} left` : "no dice left");
    const groupsView = menu.groups.map(g => ({
      key: g.key, label: g.label, off: g.left <= 0,
      tag: leftTag(g),
      rows: g.rows.map(r => ({ key: r.key, label: r.label, cost: r.cost, caveat: r.caveat, rule: r.rule, affordable: r.affordable }))
    }));
    // The offer line in the group's own voice; with two groups, the rule both share.
    const live = menu.groups.some(g => g.left > 0);
    const solo = menu.groups.length === 1 ? menu.groups[0] : null;
    const heading = menu.groups.map(g => g.heading).join(" · ");
    const summary = live
      ? `pick one to ride this hit, or none; ${solo ? solo.per : "one pick per group"}.`
      : `${solo?.perOption ? `no ${solo.dieLabel}s left` : "no dice left"}; the rows stay for the record.`;
    return {
      html: hitMenuHTML({ groups: groupsView }),
      lines: [`<strong>${heading}</strong> — ${summary}`],
      wire(element) {
        const boxes = [...(element?.querySelectorAll('input[name="bf-hit"]') ?? [])];
        for ( const box of boxes ) {
          box.addEventListener("change", () => {
            if ( box.checked ) {
              // One pick per group: only the box's own group gives way.
              for ( const other of boxes ) {
                if ( (other !== box) && other.checked && (other.dataset.bfHitGroup === box.dataset.bfHitGroup) ) {
                  other.checked = false; chosen.delete(other.value);
                }
              }
              chosen.add(box.value);
            } else chosen.delete(box.value);
          });
        }
      },
      /** The pick, on the attack message BEFORE the roll — the rider reads it there. */
      async commit() {
        const { picks } = hitPick({ menu, chosen });
        const records = picks.filter(p => edge[p.row.key]).map(p => {
          const facts = edge[p.row.key];
          return { key: p.row.key, group: p.group, feature: p.row.feature, mode: p.row.mode,
            formula: facts.formula, type: facts.type ?? type, itemUuid: facts.item.uuid, poolUuid: facts.pool?.uuid ?? null };
        });
        try {
          await attackMessage.setFlag(MODULE_ID, "hitPick", records.length ? { picks: records } : { key: null });
        } catch(err) {
          console.error(`${TITLE} | Could not record the maneuver pick — the weapon rolls alone.`, err);
        }
      }
    };
  }
});

/* --- the rider: the die rides the weapon's damage roll, the pool is spent ------------------- */

listen("dnd5e.preRollDamage", "hit-menu", (config, _dialog, message) => {
  try {
    const activity = config.subject;
    if ( activity?.type !== "attack" ) return;
    const attackMessage = attackMessageForDamage(config, message);
    const record = attackMessage?.getFlag(MODULE_ID, "hitPick");
    if ( !record || record.rolled ) return;
    const attacker = activity.actor;
    const roll = attackMessage.rolls?.[0];
    const out = [];
    for ( const pick of picksOf(record) ) {
      const row = HIT_OPTIONS[pick.key];
      const group = HIT_GROUPS[row?.group];
      if ( !row || !group ) continue;
      const rides = (pick.mode !== "sweep") && !!pick.formula;
      if ( rides ) {
        config.rolls.push({
          // No `properties`: the die takes the weapon's type but not its magic, which decides
          // physical-resistance bypass.
          data: foundry.utils.deepClone(config.rolls[0]?.data ?? {}),
          parts: [pick.formula],
          options: { type: pick.type ?? null, types: pick.type ? [pick.type] : [] }
        });
      }
      // One use spent on the item the activity names; the count left is read after the spend.
      const pool = resolveUuid(pick.poolUuid);
      const left = pool ? Math.max(0, Number(pool.system?.uses?.value ?? 0) - 1) : null;
      // The one spend path (shared.js `spendSuperiorityDie`); the card, flash and subtitle read its record.
      const poolSpend = pool ? { pool: pool.name, spent: 1, left, max: Number(pool.system?.uses?.max ?? 0), ability: row.feature, actorUuid: attacker?.uuid ?? null, at: Date.now() } : null;
      if ( pool ) {
        void spendSuperiorityDie(attacker, pool, row.feature)
          .catch(err => console.warn(`${TITLE} | Could not spend a ${group.dieLabel}.`, err));
      }
      out.push({
        key: pick.key, feature: row.feature, group: group.label, dieLabel: group.dieLabel,
        eyebrow: group.eyebrow ?? "Maneuver", maneuver: (group.eyebrow ?? "Maneuver") === "Maneuver",
        formula: pick.formula, type: pick.type ?? null, mode: pick.mode ?? "ride", rides,
        rule: row.rule, line: row.line ?? null, caveat: row.caveat ?? null, poolLeft: left, poolSpend,
        save: !!row.save, onFail: row.onFail ?? null, effects: !!row.effects, itemUuid: pick.itemUuid,
        clock: row.clock ?? null, press: row.press ?? null
      });
    }
    if ( !out.length ) return;
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.hitManeuver`, {
      ...statContext(attacker?.uuid ?? null), attackId: attackMessage.id,
      attackRoll: roll ? { total: roll.total, isCritical: !!roll.isCritical, isFumble: !!roll.isFumble } : null,
      picks: out
    });
    // Marked rolled: the card's Damage button pressed twice must not ride twice.
    void attackMessage.setFlag(MODULE_ID, "hitPick", { ...record, rolled: true })
      .catch(err => console.warn(`${TITLE} | Could not mark the maneuver rolled.`, err));
  } catch(err) {
    console.error(`${TITLE} | The maneuver's die failed to ride — add it by hand.`, err);
  }
});

/* --- the consequences: the save at the target, the effect, the sweep card ------------------ */

/** Same-client latch: the consequences run once per damage message. */
const consequencesRun = new Set();

listen("createChatMessage", "hit-menu", message => {
  if ( !message.isAuthor ) return;
  const hm = message.getFlag(MODULE_ID, "hitManeuver");
  if ( !hm || hm.done || consequencesRun.has(message.id) ) return;
  consequencesRun.add(message.id);
  // The `hitManeuver` record landing IS the resolve; decide/moments.js publishes `maneuver` from it.
  void runConsequences(message, hm);
});

async function runConsequences(damageMessage, record) {
  try {
    const attackMessage = game.messages.get(record.attackId);
    const attacker = attackMessage?.getAssociatedActor();
    if ( !attackMessage || !attacker ) return;
    const hits = hitTargets(attackMessage);
    const tokens = hits.map(t => tokenForUuid(t.uuid)).filter(Boolean);
    const notes = [];
    for ( const pick of picksOf(record) ) {
      const hm = { ...pick, attackId: record.attackId, attackRoll: record.attackRoll ?? pick.attackRoll ?? null };
      // live only: the paying feature is never used up, so the sheet is the truth
      const item = resolveUuid(hm.itemUuid);
      if ( !item ) continue;
      await consequencesOf(damageMessage, hm, { attackMessage, attacker, hits, tokens, item, notes });
    }
    await damageMessage.setFlag(MODULE_ID, "hitManeuver", { ...record, done: true, ...(notes.length ? { notes: [...(record.notes ?? []), ...notes] } : {}) })
      .catch(() => { /* the latch above holds for this session */ });
  } catch(err) {
    console.error(`${TITLE} | The maneuver's consequences failed — use the feature's activity by hand.`, err);
  }
}

/** One pick's consequences: its save at the target, its sweep card. */
async function consequencesOf(damageMessage, hm, { attackMessage, attacker, hits, tokens, item, notes }) {
  if ( hm.save ) {
    const act = activityOfType(item, "save");
    if ( act ) {
      await repairTransferEffects(attacker);
      // A linked effect the item lost is pressed on the failure from the compendium copy (same id).
      const missing = (await profileEffects(act.effects)).filter(({ profile, effect }) => !effect && !profile.onSave).map(({ profile }) => profile._id);
      const source = missing.length ? await compendiumCopyOf(item) : null;
      const pressUuids = missing.map(id => source?.effects?.get(id)?.uuid).filter(Boolean);
      if ( missing.length && !pressUuids.length ) notes.push(`${hm.feature}: its effect is missing from the sheet and its source could not be read — apply it by hand`);
      const results = await withTargets(tokens, () => act.use({}, { configure: false }, {}));
      const card = results?.message;
      if ( card instanceof ChatMessage ) {
        // The follow-up's effect: a condition the pack left on the ITEM, unlinked (Trip's Prone).
        const effectUuid = hm.onFail ? (item.effects.find(e => e.statuses?.has?.(hm.onFail))?.uuid ?? null) : null;
        await card.setFlag(MODULE_ID, "hitManeuverCard", { ...statContext(attacker.uuid), attackId: attackMessage.id,
          damageId: damageMessage.id, key: hm.key, feature: hm.feature, rule: hm.rule, line: hm.line, attackerName: attacker.name,
          onFail: hm.onFail ?? null, effectUuid, pressUuids, applied: [] });
      }
    } else notes.push(`${hm.feature}: no save activity on the sheet`);
  }
  if ( hm.mode === "sweep" ) await postSweepCard(damageMessage, hm, attackMessage, attacker, hits, item);
}

/* --- the effect on the hit, on the elect (Distracting Strike) -------------------------------- */

async function settleHitEffects(message) {
  const record = message.getFlag(MODULE_ID, "hitManeuver");
  const picks = picksOf(record).map((p, index) => ({ p, index })).filter(({ p }) => p.effects || p.press);
  if ( !picks.length || record.effectsApplied ) return;
  if ( !drivesMomentFor(record.sourceUuid ?? null) ) return;
  try {
    let claimed = false;
    await queueFlagWrite(message, "hitManeuver", current => {
      if ( current.effectsApplied ) return false;
      current.effectsApplied = true;
      claimed = true;
    });
    if ( !claimed ) return;
    const attackMessage = game.messages.get(record.attackId);
    const hits = attackMessage ? hitTargets(attackMessage) : [];
    for ( const { p: hm, index } of picks ) {
      // live only: the paying feature is never used up, so the sheet is the truth
      const item = resolveUuid(hm.itemUuid);
      if ( hm.effects ) {
        // The shared path (effect-riders.js), also used by the clock riders' `effects` rows.
        const attacker = resolveUuid(record.sourceUuid ?? null) ?? attackMessage?.getAssociatedActor?.() ?? null;
        await applyActivityEffectsOnHit(message, item ? activityOfType(item, "damage") : null, hits,
          { clock: hm.clock ?? null, attacker, source: statSourceOf(message) });
      }
      if ( hm.press ) await pressOnHit(message, { ...hm, sourceUuid: record.sourceUuid ?? null }, hits, item, Array.isArray(record.picks) ? index : null);
    }
  } catch(err) {
    console.error(`${TITLE} | The maneuver's effect failed to apply.`, err);
  }
}

/**
 * THE NO-SAVE PRESS (Hill's Tumble): the status on every hit target, receipted on the damage card.
 * A target already wearing it is skipped; one the module may not write is said on the card.
 */
async function pressOnHit(message, hm, hits, item, index = null) {
  const pressed = [];
  const skipped = [];
  for ( const h of hits ) {
    const subject = fromUuidSync(h.uuid);
    const actor = (subject instanceof Actor) ? subject : (subject?.actor ?? null);
    if ( !(actor instanceof Actor) || !canApplyTo(actor) ) { skipped.push(h.name); continue; }
    if ( actor.statuses?.has?.(hm.press) ) continue;
    const landed = await forceStatus(actor, hm.press, { origin: item?.uuid ?? null });
    const effect = landed ? actor.effects.find(e => e.statuses?.has?.(hm.press)) : null;
    if ( !effect ) { skipped.push(h.name); continue; }
    pressed.push(h.name);
    const description = await ruleHTML(hm.rule);
    await queueFlagWrite(message, "effectReceipt", current => {
      joinEffectReceipt(current, { uuid: h.uuid, name: h.name, img: actor.img ?? null,
        effects: [effectRecord({ id: effect.id, name: effect.name, img: effect.img, description }, statContext(hm.sourceUuid ?? null))] });
    });
  }
  await queueFlagWrite(message, "hitManeuver", current => {
    // the pick's own record in the list (an older single record holds its fields itself)
    const target = ((index !== null) && current.picks?.[index]) ? current.picks[index] : current;
    target.pressed = pressed;
    if ( skipped.length ) current.notes = [...(current.notes ?? []), `${hm.feature}: ${skipped.join(", ")} — apply ${hm.press} by hand`];
  });
}

/* --- the follow-up: what a FAILED save presses that the activity did not carry --------------- */

const followups = new Set();

async function settleHitFollowups(card) {
  const hc = card.getFlag(MODULE_ID, "hitManeuverCard");
  const saves = card.getFlag(MODULE_ID, "saves");
  const uuids = [...(hc?.effectUuid && hc.onFail ? [hc.effectUuid] : []), ...(hc?.pressUuids ?? [])];
  const verdicts = verdictsOn(saves);   // the answered targets, through the one reader
  if ( !uuids.length || !verdicts.length ) return;
  if ( !drivesMomentFor(saves.sourceUuid ?? hc.sourceUuid ?? null) ) return;
  for ( const t of verdicts ) {
    if ( (t.outcome !== "failed") || hc.applied?.includes?.(t.uuid) ) continue;
    const key = `${card.id}|${t.uuid}`;
    if ( followups.has(key) ) continue;
    followups.add(key);
    try {
      let claimed = false;
      await queueFlagWrite(card, "hitManeuverCard", current => {
        if ( !Array.isArray(current.applied) ) current.applied = [];
        if ( current.applied.includes(t.uuid) ) return false;
        current.applied.push(t.uuid);
        claimed = true;
      });
      if ( !claimed ) continue;
      const effects = (await Promise.all(uuids.map(u => fromUuid(u).catch(() => null)))).filter(Boolean);
      if ( effects.length ) await applyEffectsWithReceipt(card, effects, [{ uuid: t.uuid, name: t.name }], { source: statSourceOf(card) });
    } catch(err) {
      console.error(`${TITLE} | The maneuver's follow-up failed.`, err);
    } finally {
      followups.delete(key);
    }
  }
}

/* --- the sweep: a second creature, the die rolled apart, the original roll judged ------------ */

async function postSweepCard(damageMessage, hm, attackMessage, attacker, hits, item) {
  const target = hits[0] ? tokenForUuid(hits[0].uuid) : null;
  const attackerToken = tokenOfActor(attacker);
  // Within 5 feet of the original target AND within the weapon's reach, read off the sheet.
  const weapon = messageActivity(attackMessage)?.item ?? null;
  const reach = Number(weapon?.system?.range?.reach) || 5;
  const candidates = [];
  const outOfReach = [];
  if ( target ) {
    for ( const t of (canvas.tokens?.placeables ?? []) ) {
      if ( !t.actor || (t === target) || (t === attackerToken) || t.document.hidden ) continue;
      if ( hits.some(h => h.uuid === t.actor.uuid) ) continue;
      const feet = nearestFeet(target, t);
      if ( (feet === null) || (feet > 5) ) continue;
      const fromYou = attackerToken ? nearestFeet(attackerToken, t) : null;
      if ( (fromYou !== null) && (fromYou > reach) ) { outOfReach.push(t.document.name); continue; }
      candidates.push({ uuid: t.actor.uuid, tokenUuid: t.document.uuid, name: t.document.name });
    }
  }
  // The hold family's window (the save choice's clock): 0 waits for a human.
  const window = candidates.length ? decisionWindow() : 0;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `<p>${hm.feature} — ${candidates.length ? "pick the second creature" : "no creature within 5 feet of the target"}.</p>`,
    flags: { [MODULE_ID]: { sweepCard: { ...statContext(attacker.uuid), attackId: attackMessage.id, damageId: damageMessage.id,
      feature: hm.feature, rule: hm.rule, formula: hm.formula, type: hm.type, attackRoll: hm.attackRoll, itemImg: item?.img ?? null,
      targetName: hits[0]?.name ?? "the target", candidates, outOfReach, reach, chosen: null, resolved: null,
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}) } } }
  });
}

// The pick folds onto the card: a GM writes it straight, a player's click travels as an envelope.
registerRelay("sweepAnswer", {
  flagKey: "sweepCard",
  targetOf: a => a.cardId,
  owns: flag => drivesMomentFor(flag?.sourceUuid ?? null),
  fold: (current, a) => {
    if ( current.chosen || ((a.uuid !== "none") && !current.candidates?.some(c => c.uuid === a.uuid)) ) return false;
    current.chosen = a.uuid;
    current.answeredAt = Date.now();
  },
  cleanup: true
});

/** The attacker's pick — a creature's uuid, or "none" (the die is spent; nobody is swept). */
async function chooseSweep(card, uuid) {
  const flag = card.getFlag(MODULE_ID, "sweepCard");
  if ( flag?.chosen || ((uuid !== "none") && !flag?.candidates?.some(c => c.uuid === uuid)) ) return;
  if ( card.canUserModify?.(game.user, "update") ) {
    await queueFlagWrite(card, "sweepCard", current => { if ( current.chosen ) return false; current.chosen = uuid; current.answeredAt = Date.now(); });
    return;
  }
  await ChatMessage.create({ whisper: [game.user.id], speaker: { alias: TITLE }, content: `<p>${uuid}</p>`,
    flags: { [MODULE_ID]: { sweepAnswer: { cardId: card.id, uuid } } } });
}

/** The pick as a POPUP (the moment spine): a button per creature within 5 feet, Nobody, the bar. */
async function showSweepPopup(card) {
  const sc = card.getFlag(MODULE_ID, "sweepCard");
  if ( !sc || sc.chosen || !sc.candidates?.length ) return;
  const attacker = resolveUuid(sc.sourceUuid);
  const dialog = await openMomentPopup(card, "sweep", attacker, {
    title: `${sc.feature} — ${attacker?.name ?? ""}`,
    icon: "fa-solid fa-arrows-left-right",
    content: bfCard({
      img: sc.itemImg, eyebrow: `Maneuver — ${sc.feature}`, tone: "pending",
      title: `${sc.feature} — pick the second creature`,
      subtitle: `Within 5 feet of ${sc.targetName} and within your reach (${sc.reach ?? 5} ft)${sc.outOfReach?.length ? ` — out of reach: ${sc.outOfReach.join(", ")}` : ""}.`,
      lines: [ruleLine(sc.rule),
        `The die is rolled at the creature you pick; it takes the roll if your attack roll (${sc.attackRoll?.total ?? "?"}) would hit it.`]
    }) + momentBarHTML(sc, "to pick"),
    buttons: [
      ...sc.candidates.map((c, i) => ({ action: `pick-${i}`, label: c.name, default: i === 0,
        callback: () => chooseSweep(card, c.uuid) })),
      { action: "none", label: "Nobody", callback: () => chooseSweep(card, "none") }
    ]
  });
  // Hovering a creature's button pings its token and lights its hover state (public API only).
  for ( const b of (dialog?.element?.querySelectorAll('button[data-action^="pick-"]') ?? []) ) {
    const c = sc.candidates[Number(b.dataset.action.slice(5))];
    const token = c?.tokenUuid ? canvas.tokens?.get(fromUuidSync(c.tokenUuid)?.id ?? "") : null;
    if ( !token ) continue;
    b.addEventListener("mouseenter", () => {
      try {
        canvas.ping(token.center, { duration: 900, size: 96 });
        token._onHoverIn?.(new PointerEvent("pointerover"), { hoverOutOthers: true });
      } catch { /* a token off the canvas, or a layer mid-teardown */ }
    });
    b.addEventListener("mouseleave", () => { try { token._onHoverOut?.(new PointerEvent("pointerout")); } catch { /* as above */ } });
  }
}

/** The elect's clock on the pick: the only creature when there is one, nobody otherwise. */
const sweepTimers = new Map();
function armSweepTimer(card) {
  const sc = card.getFlag(MODULE_ID, "sweepCard");
  if ( !sc || sc.chosen || !sc.deadline || !drivesMomentFor(sc.sourceUuid ?? null) ) { disarmDeadline(sweepTimers, card.id); return; }
  armDeadline(sweepTimers, card.id, sc.deadline, async id => {
    try {
      const c = game.messages.get(id);
      if ( !c ) return;
      await queueFlagWrite(c, "sweepCard", current => {
        if ( current.chosen || !current.deadline || (current.deadline > Date.now()) ) return false;
        current.chosen = (current.candidates?.length === 1) ? current.candidates[0].uuid : "none";
        current.timedOut = true;
        current.answeredAt = Date.now();
      });
    } catch(err) {
      console.error(`${TITLE} | The sweep's buzzer failed.`, err);
    }
  });
}

async function settleSweep(card) {
  const sc = card.getFlag(MODULE_ID, "sweepCard");
  if ( !sc?.chosen || sc.resolved ) return;
  if ( !drivesMomentFor(sc.sourceUuid ?? null) ) return;
  try {
    let claimed = false;
    await queueFlagWrite(card, "sweepCard", current => {
      if ( current.resolved || current.resolving ) return false;
      current.resolving = true;
      claimed = true;
    });
    if ( !claimed ) return;
    if ( sc.chosen === "none" ) {
      await queueFlagWrite(card, "sweepCard", current => { current.resolving = false; current.resolved = { none: true }; });
      return;
    }
    const pick = sc.candidates.find(c => c.uuid === sc.chosen);
    const actor = pick ? fromUuidSync(pick.uuid) : null;
    const attacker = resolveUuid(sc.sourceUuid);
    const roll = await new Roll(sc.formula || "1d8").evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: attacker }), flavor: `${sc.feature} — the die, at ${pick?.name ?? "the second creature"}` });
    const verdict = sweepVerdict({ ...(sc.attackRoll ?? { total: 0 }), ac: actor?.system?.attributes?.ac?.value ?? null });
    if ( (verdict === "hit") && pick ) {
      await applyDamagesWithReceipt(card, [{ uuid: pick.uuid, name: pick.name }],
        [{ value: roll.total, type: sc.type ?? null, properties: new Set() }], { note: sc.feature });
    }
    await queueFlagWrite(card, "sweepCard", current => {
      current.resolving = false;
      current.resolved = { rolled: roll.total, verdict, name: pick?.name ?? null, ac: actor?.system?.attributes?.ac?.value ?? null };
    });
  } catch(err) {
    console.error(`${TITLE} | The sweep failed to resolve — roll the die by hand.`, err);
  }
}

// Effects resume on arrival and reload (never an update); follow-ups and the sweep on the answer.
registerResumable("hitManeuver", {
  pending: (flag, _message, cause) => (cause !== "update") && picksOf(flag).some(p => p.effects || p.press) && !flag.effectsApplied,
  drives: flag => drivesMomentFor(flag.sourceUuid ?? null),
  drive: settleHitEffects
});
registerResumable("hitManeuverCard", {
  pending: (flag, _message, cause) => (cause !== "create") && !!(flag.onFail || flag.pressUuids?.length),
  drives: (flag, message) => drivesMomentFor(message.getFlag(MODULE_ID, "saves")?.sourceUuid ?? flag.sourceUuid ?? null),
  drive: settleHitFollowups
});
registerResumable("sweepCard", {
  pending: (flag, _message, cause) => (cause !== "create") && !!flag.chosen && !flag.resolved,
  drives: flag => drivesMomentFor(flag.sourceUuid ?? null),
  drive: settleSweep
});

/* --- the cards say it (R5) -------------------------------------------------------------------- */

listen("dnd5e.renderChatMessage", "hit-menu", (message, html) => {
  const record = message.getFlag(MODULE_ID, "hitManeuver");
  const picks = picksOf(record);
  // A card per pick; the record's notes ride the last.
  picks.forEach((pick, i) => {
    const hm = { ...pick, notes: (i === picks.length - 1) ? [...(pick.notes ?? []), ...(Array.isArray(record.picks) ? (record.notes ?? []) : [])] : (pick.notes ?? []) };
    const line = document.createElement("div");
    // A no-die press says what it pressed; the eyebrow is the group's family word.
    const pressTitle = hm.press
      ? `${hm.feature} — ${hm.pressed?.length ? `${hm.pressed.join(", ")} ${hm.pressed.length === 1 ? "has" : "have"}` : "the target has"} the ${hm.press.charAt(0).toUpperCase()}${hm.press.slice(1)} condition`
      : null;
    line.innerHTML = bfCard({
      eyebrow: `${hm.eyebrow ?? "Maneuver"} — ${hm.feature}`, tone: hm.rides || (hm.mode === "sweep") || hm.press ? "good" : "neutral",
      title: hm.rides ? `${hm.feature} — ${hm.formula}${hm.type ? ` ${hm.type}` : ""} rode this roll`
        : (hm.mode === "sweep") ? `${hm.feature} — the die is rolled at a second creature`
          : pressTitle ?? `${hm.feature} — its die could not be read off the sheet`,
      subtitle: `${spendPhrase(hm.poolSpend ? [hm.poolSpend] : [], hm.dieLabel)}${hm.caveat ? ` · ${hm.caveat}` : ""}`,
      lines: [hm.line, ruleLine(hm.rule), ...(hm.notes ?? []).map(n => `<span style="opacity:0.8;">${n}</span>`)]
    });
    html.querySelector(SURFACES.messageContent)?.appendChild(line);
  });
  const hc = message.getFlag(MODULE_ID, "hitManeuverCard");
  if ( hc ) {
    const line = document.createElement("div");
    line.innerHTML = bfCard({
      eyebrow: `Maneuver — ${hc.feature}`, tone: "neutral",
      title: `${hc.feature} — from ${hc.attackerName ?? "the attacker"}’s hit`,
      lines: [hc.line, ruleLine(hc.rule)]
    });
    html.querySelector(SURFACES.messageContent)?.appendChild(line);
  }
  const sc = message.getFlag(MODULE_ID, "sweepCard");
  if ( sc ) {
    const r = sc.resolved;
    const chosenName = sc.candidates?.find(c => c.uuid === sc.chosen)?.name ?? null;
    const line = document.createElement("div");
    line.innerHTML = bfCard({
      img: sc.itemImg ?? null, eyebrow: `Maneuver — ${sc.feature}`, tone: r ? ((r.verdict === "hit") ? "good" : "neutral") : "pending",
      title: r?.none ? `${sc.feature} — nobody swept${sc.timedOut ? " (timer)" : ""}; the die was spent`
        : r ? `${sc.feature} — ${r.name ?? chosenName}: the die rolled ${r.rolled}, ${r.verdict === "hit" ? "the attack would hit — applied" : r.verdict === "miss" ? "the attack would miss" : "its AC could not be read"}${(r.ac !== null && r.ac !== undefined) ? ` (AC ${r.ac})` : ""}`
        : chosenName ? `${sc.feature} — ${chosenName}: rolling the die` : sc.candidates?.length ? `${sc.feature} — pick the second creature` : `${sc.feature} — no creature within 5 feet of ${sc.targetName} and within your reach${sc.outOfReach?.length ? ` (out of reach: ${sc.outOfReach.join(", ")})` : ""}; the die was spent`,
      subtitle: (!r && sc.candidates?.length && !chosenName) ? `within 5 feet of ${sc.targetName} and within your reach` : "",
      lines: [ruleLine(sc.rule)]
    }) + ((!sc.chosen && sc.candidates?.length) ? momentBarHTML(sc, "to pick") : "");
    html.querySelector(SURFACES.messageContent)?.appendChild(line);
    const attacker = resolveUuid(sc.sourceUuid);
    if ( !sc.chosen && sc.candidates?.length && canAnswerFor(attacker) ) {
      // The popup is the ask (the moment spine); the card keeps a button to reopen it.
      const shownKey = popupKey(message.id, "sweep");
      if ( !shownMoments.has(shownKey) ) { shownMoments.add(shownKey); void showSweepPopup(message); }
      line.appendChild(momentButton(`Pick — ${sc.feature}`, () => void showSweepPopup(message)));
    }
    armSweepTimer(message);
  }
});
