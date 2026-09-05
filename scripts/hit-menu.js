/**
 * Battle Flow — The hit menu: on a hit, the options the sheet grants are offered before the dice, grouped by the feature that pays; the die rides the roll, the pool is spent, the save goes through the saves machine.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, canAnswerFor, drivesMomentFor, queueFlagWrite, statContext } from "./core.js";
import { hitMenuEntries } from "./settings.js";
import { hitTargets, statSourceOf, withTargets } from "./shared.js";
import { bfCard, hitMenuHTML, momentBarHTML, popupKey, ruleLine } from "./decide/present.js";
import { HIT_GROUPS, HIT_OPTIONS } from "./decide/registry.js";
import { hitMenu, hitPick, sweepVerdict } from "./decide/hit-menu.js";
import { riderPartFormula } from "./decide/clock.js";
import { nearestFeet, tokenForUuid, tokenOfActor } from "./geometry.js";
import { attackMessageForDamage, registerOfferPart } from "./auto-damage.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { applyEffectsWithReceipt, messageActivity } from "./effect-riders.js";
import { armDeadline, disarmDeadline, momentButton, openMomentPopup, registerRelay, shownMoments } from "./ui.js";

/* ---------------------------------------------------------------------------------------------
 * THE HIT MENU (user, 2026-09-04 — "the actor should be given a choice if they have maneuvers,
 * to pick when they hit"; the prototype *Battle Flow Hit Menu*, "looks good"; the sweep's ruling
 * of 2026-09-03: ONE popup per hit, grouped by the feature that grants the rows). Cunning Strike
 * (sneak.js) was the first instance of "on a hit, pick what rides before the dice"; this is the
 * general machine, and the Battle Master's eight on-hit maneuvers are its first rows
 * (decide/registry.js HIT_GROUPS / HIT_OPTIONS; membership is the Hit Menu list).
 *
 *   THE OFFER (auto-damage.js, through `registerOfferPart`) — a group per paying feature on the
 *   sheet (Combat Superiority), a checkbox per listed option the sheet grants, the row the name
 *   and its cost and nothing else (user: "just give the cost for the sup die, just like Cunning
 *   Strike"), one pick per group. An affordable row OPENS the offer even under auto damage —
 *   there is a decision pending. The pick is written on the attack message BEFORE the dice.
 *
 *   THE RIDER (`preRollDamageV2`, the hit-riders seam, on the roller's client) — the die, read
 *   off the option's own damage activity and resolved on the sheet, rides the damage roll as its
 *   own part in the weapon's type, crit-doubled by the same stamp; the pool the activity names
 *   is spent (one use, the way a clock rider's limited use is spent); the card says what rode.
 *   A SWEEP rides nothing: its die is rolled apart, below.
 *
 *   THE CONSEQUENCES (the damage message landing, on the roller's client — which owns the
 *   fighter and its items, so `use()` is theirs) — the option's save activity is used at the hit
 *   target, so the demand, the timer, the roll and the failed-save press are the saves machine's
 *   and the condition the activity carries lands through it; a condition the pack left on the
 *   ITEM unlinked (Trip's Prone) is pressed on the failure by the follow-up, on the elect; an
 *   option whose damage activity carries an effect and no save (Distracting Strike) has it
 *   applied on the elect, receipted; a LINE option (Maneuvering Attack, Pushing, Disarming)
 *   says on the card what the table plays.
 *
 *   THE SWEEP (Sweeping Attack) — a card lists the creatures within 5 feet of the original
 *   target and a POPUP asks the attacker to pick one (user, 2026-09-04: "sweeping attack should
 *   be a popup choice, its just on the card"): the moment spine — a button per creature, the
 *   clock (the hold family's window), a default when it runs out (the only creature when there
 *   is one; nobody otherwise — the die is already spent, and the card says so). A GM writes the
 *   pick straight, a player's click travels as an envelope (the relay idiom); the elect rolls the
 *   die in the open, judges the ORIGINAL attack roll against the second creature's AC
 *   (decide/hit-menu.js `sweepVerdict`), and applies the die through the receipt chokepoint
 *   when it would hit.
 *
 * WHAT IS READ, NEVER TYPED (N1): the die formula, the pool (the activity's consumption target
 * — an id, an identifier, or a compendium source: the three shapes the 2024 pack ships), the
 * save and its DC, the condition. The table carries only names and rules text.
 * ------------------------------------------------------------------------------------------- */

const lower = s => String(s ?? "").toLowerCase();
const featureNamed = (actor, name) => actor?.items?.find(i => (i.type === "feat") && (lower(i.name) === lower(name))) ?? null;
const activityOfType = (item, type) => [...(item?.system?.activities ?? [])].find(a => a.type === type) ?? null;

/**
 * The pool an activity consumes — the item its first `itemUses` target names. The 2024 pack
 * ships the target three ways (measured 2026-09-04): an item ID once advancement has remapped
 * it, the bare identifier `combat-superiority` (Trip, Goading, Menacing, Pushing, Disarming,
 * Maneuvering), and the compendium UUID of Combat Superiority (Distracting, Sweeping).
 */
function poolOf(actor, activity) {
  for ( const c of (activity?.consumption?.targets ?? []) ) {
    if ( c.type !== "itemUses" ) continue;
    const target = String(c.target ?? "");
    if ( !target ) return activity.item ?? null;
    const item = actor.items.get(target)
      ?? actor.items.find(i => (i.system?.identifier === target) || (i.identifier === target))
      ?? actor.items.find(i => (i._stats?.compendiumSource === target) || (i.flags?.core?.sourceId === target))
      ?? actor.items.find(i => target.endsWith(`.${i._stats?.compendiumSource?.split(".").pop() ?? "\u0000"}`));
    if ( item ) return item;
  }
  return null;
}

/** The die behind an option — its damage activity's first part, resolved on the sheet. "d8" reads as "1d8". */
function dieFormulaOf(actor, activity) {
  const part = activity?.damage?.parts?.[0];
  const raw = part ? riderPartFormula({ number: part.number, denomination: part.denomination, custom: part.custom, bonus: part.bonus }) : null;
  if ( !raw ) return null;
  try {
    const resolved = String(Roll.replaceFormulaData(raw, actor.getRollData())).trim().replace(/^d(\d+)/i, "1d$1");
    return Roll.validate(resolved) && !/@/.test(resolved) ? resolved : null;
  } catch { return null; }
}

/**
 * The menu for this hit, and the sheet facts behind every row: the option's item, its damage and
 * save activities, its resolved die, the pool it draws on, the weapon's damage type.
 */
function menuFor(attackMessage, activity) {
  const attacker = activity?.actor ?? attackMessage?.getAssociatedActor();
  const item = activity?.item;
  if ( !attacker || !item ) return null;
  const listed = hitMenuEntries().map(e => e.kind);
  if ( !listed.length ) return null;
  const features = attacker.items.filter(i => i.type === "feat").map(i => i.name);
  const edge = {};
  const pools = {};
  for ( const [gkey, group] of Object.entries(HIT_GROUPS) ) {
    if ( !featureNamed(attacker, group.feature) ) continue;
    for ( const [key, row] of Object.entries(HIT_OPTIONS) ) {
      if ( row.group !== gkey ) continue;
      const feat = featureNamed(attacker, row.feature);
      const die = feat ? activityOfType(feat, "damage") : null;
      if ( !feat || !die ) continue;
      const pool = poolOf(attacker, die);
      const formula = dieFormulaOf(attacker, die);
      edge[key] = { item: feat, dieActivity: die, saveActivity: activityOfType(feat, "save"), pool, formula };
      pools[gkey] ??= pool ? { left: Number(pool.system?.uses?.value ?? 0), die: formula } : null;
      if ( pools[gkey] && !pools[gkey].die && formula ) pools[gkey].die = formula;
    }
  }
  const melee = activity.attack?.type?.value !== "ranged";
  const menu = hitMenu({ groups: HIT_GROUPS, options: HIT_OPTIONS, listed, features, melee, pools });
  const type = [...(item.system?.damage?.base?.types ?? [])][0] ?? null;
  return { attacker, menu, edge, type };
}

/* --- the pack's transfer flag, corrected on the sheet --------------------------------------- */

/**
 * THE PACK SHIPS GOADED AS A TRANSFER EFFECT (measured 2026-09-04): Goading Attack's "Goaded" —
 * linked to its save activity, meant for the TARGET — carries `transfer: true`, so Foundry
 * treats it as a passive on the WIELDER: Morgash's own sheet showed Goaded (user: "but he should
 * never have the effect … it should be who he hits"), and the first turn expiry or a hand tidy
 * of that sheet deleted the item's only copy, leaving the save nothing to apply. A row's
 * target-facing effects are the save activity's (rows with `save`), the damage activity's (rows
 * with `effects`) and the status the row presses on a failure (`onFail`); any of those with the
 * flag set is corrected on the wielder's own copy of the item — the actor's world data, never
 * the compendium — by the client that owns it, at ready and when the item lands.
 */
function targetFacingEffects(row, item) {
  const out = [];
  if ( row.save ) for ( const e of (activityOfType(item, "save")?.effects ?? []) ) if ( e.effect ) out.push(e.effect);
  if ( row.effects ) for ( const e of (activityOfType(item, "damage")?.effects ?? []) ) if ( e.effect ) out.push(e.effect);
  if ( row.onFail ) { const e = item.effects.find(x => x.statuses?.has?.(row.onFail)); if ( e ) out.push(e); }
  return out;
}

/**
 * The compendium's own copy of an item on a sheet: its recorded source when it has one, else
 * the premium packs' item of the same name (a copy made from pack data records no source —
 * the fixture's, the MCP importer's, a GM's hand-built one; measured 2026-09-04 — and the SRD
 * packs come last, the house order). The pack's effect ids are the ones the activity names.
 */
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
    for ( const effect of targetFacingEffects(row, item) ) {
      if ( !effect.transfer ) continue;
      try {
        await effect.update({ transfer: false });
        console.info(`${TITLE} | ${actor.name}'s ${item.name}: "${effect.name}" is a target's effect the pack flagged as the wielder's passive — corrected on the sheet.`);
      } catch(err) {
        console.warn(`${TITLE} | Could not correct ${item.name}'s "${effect.name}" on ${actor.name}.`, err);
      }
    }
  }
}

Hooks.once("ready", () => {
  if ( !hitMenuEntries().length ) return;
  for ( const actor of game.actors.filter(a => a.isOwner) ) void repairTransferEffects(actor);
});
Hooks.on("createItem", (item, options, userId) => {
  if ( (userId !== game.user.id) || !(item.parent instanceof Actor) || (item.type !== "feat") ) return;
  if ( Object.values(HIT_OPTIONS).some(r => lower(r.feature) === lower(item.name)) ) void repairTransferEffects(item.parent);
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
    const groupsView = menu.groups.map(g => ({
      key: g.key, label: g.label, off: g.left <= 0,
      tag: g.left > 0 ? `${g.left} × ${g.die ?? "die"} left` : "no dice left",
      rows: g.rows.map(r => ({ key: r.key, label: r.label, cost: r.cost, caveat: r.caveat, rule: r.rule, affordable: r.affordable }))
    }));
    return {
      html: hitMenuHTML({ groups: groupsView }),
      lines: [`<strong>Maneuvers</strong> — ${menu.groups.some(g => g.left > 0) ? "pick one to ride this hit, or none; one maneuver per attack." : "no dice left; the rows stay for the record."}`],
      wire(element) {
        const boxes = [...(element?.querySelectorAll('input[name="bf-hit"]') ?? [])];
        for ( const box of boxes ) {
          box.addEventListener("change", () => {
            if ( box.checked ) {
              // One pick per group: the sibling gives way (the rules — "only one maneuver per attack").
              for ( const other of boxes ) {
                if ( (other !== box) && (other.dataset.bfHitGroup === box.dataset.bfHitGroup) && other.checked ) { other.checked = false; chosen.delete(other.value); }
              }
              chosen.add(box.value);
            } else chosen.delete(box.value);
          });
        }
      },
      /** The pick, on the attack message BEFORE the roll — the rider reads it there. */
      async commit() {
        const { picks } = hitPick({ menu, chosen });
        const pick = picks[0] ?? null;
        const facts = pick ? edge[pick.row.key] : null;
        try {
          await attackMessage.setFlag(MODULE_ID, "hitPick", pick && facts ? {
            key: pick.row.key, group: pick.group, feature: pick.row.feature, mode: pick.row.mode,
            formula: facts.formula, type, itemUuid: facts.item.uuid, poolUuid: facts.pool?.uuid ?? null
          } : { key: null });
        } catch(err) {
          console.error(`${TITLE} | Could not record the maneuver pick — the weapon rolls alone.`, err);
        }
      }
    };
  }
});

/* --- the rider: the die rides the weapon's damage roll, the pool is spent ------------------- */

Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
  try {
    const activity = config.subject;
    if ( activity?.type !== "attack" ) return;
    const attackMessage = attackMessageForDamage(config, message);
    const pick = attackMessage?.getFlag(MODULE_ID, "hitPick");
    if ( !pick?.key || pick.rolled ) return;
    const row = HIT_OPTIONS[pick.key];
    const group = HIT_GROUPS[row?.group];
    if ( !row || !group ) return;
    const attacker = activity.actor;
    const rides = (pick.mode !== "sweep") && !!pick.formula;
    if ( rides ) {
      config.rolls.push({
        // No `properties`: the die is the weapon's type but not its magic — it must not inherit
        // the flags that decide physical-resistance bypass (hit-riders' rule).
        data: config.rolls[0]?.data ?? {},
        parts: [pick.formula],
        options: { type: pick.type ?? null, types: pick.type ? [pick.type] : [] }
      });
    }
    // The pool: one die spent, on the item the activity names — the clock riders' idiom for a
    // limited use. The count left is read AFTER the spend for the card.
    const pool = pick.poolUuid ? fromUuidSync(pick.poolUuid) : null;
    const left = pool ? Math.max(0, Number(pool.system?.uses?.value ?? 0) - 1) : null;
    if ( pool ) {
      void pool.update({ "system.uses.spent": Number(pool.system?.uses?.spent ?? 0) + 1 })
        .catch(err => console.warn(`${TITLE} | Could not spend a ${group.dieLabel}.`, err));
    }
    const roll = attackMessage.rolls?.[0];
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.hitManeuver`, {
      ...statContext(attacker?.uuid ?? null),
      attackId: attackMessage.id, key: pick.key, feature: row.feature, group: group.label, dieLabel: group.dieLabel,
      formula: pick.formula, type: pick.type ?? null, mode: pick.mode ?? "ride", rides,
      rule: row.rule, line: row.line ?? null, caveat: row.caveat ?? null, poolLeft: left,
      save: !!row.save, onFail: row.onFail ?? null, effects: !!row.effects, itemUuid: pick.itemUuid,
      attackRoll: roll ? { total: roll.total, isCritical: !!roll.isCritical, isFumble: !!roll.isFumble } : null
    });
    // Spent by dealing the damage: the card's Damage button pressed twice must not ride twice.
    void attackMessage.setFlag(MODULE_ID, "hitPick", { ...pick, rolled: true })
      .catch(err => console.warn(`${TITLE} | Could not mark the maneuver rolled.`, err));
  } catch(err) {
    console.error(`${TITLE} | The maneuver's die failed to ride — add it by hand.`, err);
  }
});

/* --- the consequences: the save at the target, the effect, the sweep card ------------------ */

/** Same-client latch: the consequences run once per damage message. */
const consequencesRun = new Set();

Hooks.on("createChatMessage", message => {
  if ( !message.isAuthor ) return;
  const hm = message.getFlag(MODULE_ID, "hitManeuver");
  if ( !hm || hm.done || consequencesRun.has(message.id) ) return;
  consequencesRun.add(message.id);
  void runConsequences(message, hm);
});

async function runConsequences(damageMessage, hm) {
  try {
    const attackMessage = game.messages.get(hm.attackId);
    const attacker = attackMessage?.getAssociatedActor();
    const item = hm.itemUuid ? fromUuidSync(hm.itemUuid) : null;
    if ( !attackMessage || !attacker || !item ) return;
    const hits = hitTargets(attackMessage);
    const tokens = hits.map(t => tokenForUuid(t.uuid)).filter(Boolean);
    const notes = [];
    if ( hm.save ) {
      const act = activityOfType(item, "save");
      if ( act ) {
        await repairTransferEffects(attacker);
        // A linked effect the item has LOST (the transfer-flag story above, before the repair
        // ran) is pressed on the failure from the compendium's own copy — the same effect id
        // on the source item; the content is read, never typed.
        const missing = (act.effects ?? []).filter(e => !e.effect && !e.onSave).map(e => e._id);
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
    await damageMessage.setFlag(MODULE_ID, "hitManeuver", { ...hm, done: true, ...(notes.length ? { notes } : {}) })
      .catch(() => { /* the latch above holds for this session */ });
  } catch(err) {
    console.error(`${TITLE} | The maneuver's consequences failed — use the feature's activity by hand.`, err);
  }
}

/* --- the effect on the hit, on the elect (Distracting Strike) -------------------------------- */

/** Same-client latch per damage message. */
const effectsRun = new Set();

async function settleHitEffects(message) {
  const hm = message.getFlag(MODULE_ID, "hitManeuver");
  if ( !hm?.effects || hm.effectsApplied || effectsRun.has(message.id) ) return;
  if ( !drivesMomentFor(hm.sourceUuid ?? null) ) return;
  effectsRun.add(message.id);
  try {
    let claimed = false;
    await queueFlagWrite(message, "hitManeuver", current => {
      if ( current.effectsApplied ) return false;
      current.effectsApplied = true;
      claimed = true;
    });
    if ( !claimed ) return;
    const attackMessage = game.messages.get(hm.attackId);
    const item = hm.itemUuid ? fromUuidSync(hm.itemUuid) : null;
    const die = item ? activityOfType(item, "damage") : null;
    const effects = [...(die?.effects ?? [])].map(e => e.effect ?? item.effects.get(e._id)).filter(Boolean);
    const hits = attackMessage ? hitTargets(attackMessage) : [];
    if ( effects.length && hits.length ) await applyEffectsWithReceipt(message, effects, hits, { source: statSourceOf(message) });
  } catch(err) {
    console.error(`${TITLE} | The maneuver's effect failed to apply.`, err);
  } finally {
    effectsRun.delete(message.id);
  }
}

/* --- the follow-up: what a FAILED save presses that the activity did not carry --------------- */

/** Same-client latch per card+target. */
const followups = new Set();

async function settleHitFollowups(card) {
  const hc = card.getFlag(MODULE_ID, "hitManeuverCard");
  const saves = card.getFlag(MODULE_ID, "saves");
  const uuids = [...(hc?.effectUuid && hc.onFail ? [hc.effectUuid] : []), ...(hc?.pressUuids ?? [])];
  if ( !uuids.length || !saves?.targets?.length ) return;
  if ( !drivesMomentFor(saves.sourceUuid ?? hc.sourceUuid ?? null) ) return;
  for ( const t of saves.targets ) {
    if ( !t.done || (t.outcome !== "failed") || hc.applied?.includes?.(t.uuid) ) continue;
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
  // "within 5 feet of the original target AND within your reach" (user, 2026-09-04: "do you
  // exclude stuff not in reach of the weapon?" — now yes): the weapon's reach read off the
  // sheet (the system's own field — 5 feet, 10 with the Reach property), never typed here.
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
  const window = candidates.length ? Math.max(0, Number(setting(S.holdTimer)) || 0) : 0;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `<p>${hm.feature} — ${candidates.length ? "pick the second creature" : "no creature within 5 feet of the target"}.</p>`,
    flags: { [MODULE_ID]: { sweepCard: { ...statContext(attacker.uuid), attackId: attackMessage.id, damageId: damageMessage.id,
      feature: hm.feature, rule: hm.rule, formula: hm.formula, type: hm.type, attackRoll: hm.attackRoll, itemImg: item?.img ?? null,
      targetName: hits[0]?.name ?? "the target", candidates, outOfReach, reach, chosen: null, resolved: null,
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}) } } }
  });
}

// The pick is a fold onto the card (R2): a GM writes it straight, a player's click travels as an
// envelope the elect folds — the relay idiom every answer in this module rides.
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
  const attacker = sc.sourceUuid ? fromUuidSync(sc.sourceUuid) : null;
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
  // Which one is which (user, 2026-09-04: "is there a way to signal which practice dummy is the
  // target on mouseover?"): hovering a button pings that token on the map and lights its hover
  // state; leaving puts it back. Public API only — canvas.ping, the token's own hover handlers.
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

/** Same-client latch per card. */
const sweepsRun = new Set();

async function settleSweep(card) {
  const sc = card.getFlag(MODULE_ID, "sweepCard");
  if ( !sc?.chosen || sc.resolved || sweepsRun.has(card.id) ) return;
  if ( !drivesMomentFor(sc.sourceUuid ?? null) ) return;
  sweepsRun.add(card.id);
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
    const attacker = sc.sourceUuid ? fromUuidSync(sc.sourceUuid) : null;
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
  } finally {
    sweepsRun.delete(card.id);
  }
}

Hooks.on("updateChatMessage", message => {
  const hcu = message.getFlag(MODULE_ID, "hitManeuverCard");
  if ( hcu?.onFail || hcu?.pressUuids?.length ) void settleHitFollowups(message);
  if ( message.getFlag(MODULE_ID, "sweepCard")?.chosen ) void settleSweep(message);
});
Hooks.on("createChatMessage", message => {
  if ( message.getFlag(MODULE_ID, "hitManeuver")?.effects ) void settleHitEffects(message);
});

/* --- the cards say it (R5) -------------------------------------------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const hm = message.getFlag(MODULE_ID, "hitManeuver");
  if ( hm ) {
    const line = document.createElement("div");
    line.innerHTML = bfCard({
      eyebrow: "Maneuver", tone: hm.rides || (hm.mode === "sweep") ? "good" : "neutral",
      title: hm.rides ? `${hm.feature} — ${hm.formula}${hm.type ? ` ${hm.type}` : ""} rode this roll`
        : (hm.mode === "sweep") ? `${hm.feature} — the die is rolled at a second creature`
          : `${hm.feature} — its die could not be read off the sheet`,
      subtitle: `one ${hm.dieLabel} spent${(hm.poolLeft !== null && hm.poolLeft !== undefined) ? ` · ${hm.poolLeft} left` : ""}${hm.caveat ? ` · ${hm.caveat}` : ""}`,
      lines: [hm.line, ruleLine(hm.rule), ...(hm.notes ?? []).map(n => `<span style="opacity:0.8;">${n}</span>`)]
    });
    html.querySelector(".message-content")?.appendChild(line);
    if ( hm.effects ) void settleHitEffects(message);   // the resume floor
  }
  const hc = message.getFlag(MODULE_ID, "hitManeuverCard");
  if ( hc ) {
    const line = document.createElement("div");
    line.innerHTML = bfCard({
      eyebrow: "Maneuver", tone: "neutral",
      title: `${hc.feature} — from ${hc.attackerName ?? "the attacker"}’s hit`,
      lines: [hc.line, ruleLine(hc.rule)]
    });
    html.querySelector(".message-content")?.appendChild(line);
    if ( hc.onFail || hc.pressUuids?.length ) void settleHitFollowups(message);   // the resume floor
  }
  const sc = message.getFlag(MODULE_ID, "sweepCard");
  if ( sc ) {
    const r = sc.resolved;
    const chosenName = sc.candidates?.find(c => c.uuid === sc.chosen)?.name ?? null;
    const line = document.createElement("div");
    line.innerHTML = bfCard({
      eyebrow: "Sweeping Attack", tone: r ? ((r.verdict === "hit") ? "good" : "neutral") : "pending",
      title: r?.none ? `Nobody swept${sc.timedOut ? " — the clock ran out" : ""}; the die was spent`
        : r ? `${r.name ?? chosenName}: the die rolled ${r.rolled} — ${r.verdict === "hit" ? "the attack would hit, applied" : r.verdict === "miss" ? "the attack would miss" : "its AC could not be read"}${(r.ac !== null && r.ac !== undefined) ? ` (AC ${r.ac})` : ""}`
        : chosenName ? `${chosenName} — rolling the die` : sc.candidates?.length ? `Pick the second creature — within 5 feet of ${sc.targetName} and within your reach` : `No creature within 5 feet of ${sc.targetName} and within your reach${sc.outOfReach?.length ? ` (out of reach: ${sc.outOfReach.join(", ")})` : ""} — nothing to sweep; the die was spent`,
      lines: [ruleLine(sc.rule)]
    }) + ((!sc.chosen && sc.candidates?.length) ? momentBarHTML(sc, "to pick") : "");
    html.querySelector(".message-content")?.appendChild(line);
    const attacker = sc.sourceUuid ? fromUuidSync(sc.sourceUuid) : null;
    if ( !sc.chosen && sc.candidates?.length && canAnswerFor(attacker) ) {
      // The popup is the ask (the moment spine); the card keeps a button to reopen it.
      const shownKey = popupKey(message.id, "sweep");
      if ( !shownMoments.has(shownKey) ) { shownMoments.add(shownKey); void showSweepPopup(message); }
      line.appendChild(momentButton(`Pick — ${sc.feature}`, () => void showSweepPopup(message)));
    }
    armSweepTimer(message);
    if ( sc.chosen ) void settleSweep(message);   // the resume floor
  }
});
