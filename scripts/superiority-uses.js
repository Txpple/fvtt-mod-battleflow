/**
 * Battle Flow — Superiority uses: the Battle Master's Bonus Action maneuvers — a rolled bonus, a chip or a marker at the use, and the die riding the hit that follows.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, canAnswerFor, drivesMomentFor, queueFlagWrite, statContext } from "./core.js";
import { lower, featureNamed, activityNamed, resolveUuid, resolveDie } from "./lookup.js";
import { superiorityUseEntries, listedNames } from "./settings.js";
import { chipData, hitTargets, placeOf, poolSpendsOn } from "./shared.js";
import { bfCard, holdBarHTML, popupKey, riderMenuHTML, ruleLine, spendPhrase } from "./decide/present.js";
import { MANEUVER_FEATURE_NAMES, SUPERIORITY_USES, tableIndex } from "./decide/registry.js";
import { CHIP_FLAG, chipClock } from "./decide/chips.js";
import { riderPartFormula } from "./decide/clock.js";
import { armDeadline, disarmDeadline, momentButton, openMomentPopup, shownMoments } from "./ui.js";
import { attackMessageForDamage, registerOfferPart } from "./auto-damage.js";
import { applyEffectsWithReceipt } from "./effect-riders.js";

/* ---------------------------------------------------------------------------------------------
 * SUPERIORITY USES (user, 2026-09-04: "do the rest of maneuvers"). The Battle Master's Bonus
 * Action maneuvers are neither folds (Precision, Riposte) nor on-hit picks (the hit menu): each
 * is a USE whose consequence lands on a sheet, and — for two of them — a die that rides the hit
 * that follows. Measured on the 2024 PHB pack 2026-09-04 (tools/probe-pack-shapes.mjs):
 *
 *   Evasive Footwork   "Evade" (Bonus Action; a roll of the Superiority Die named "AC Bonus"), an
 *                      effect "Evasive AC" that carries NO change — the bonus is the number rolled.
 *                      The module rolls the die in the open and writes a chip with that number on
 *                      the fighter's AC until the start of their next turn (Sap's window).
 *   Bait and Switch    "Switch Places" (a willing creature within 5 feet; a roll named "Armor Class
 *                      Bonus") and TWELVE effects, "Baited AC +1" … "+12", one per face. The die is
 *                      rolled and the matching PACK effect applied to whoever the fighter chooses —
 *                      "you or the other creature (your choice)": a popup, the hold family's clock,
 *                      the fighter by default. The switch of places is the table's.
 *   Lunging Attack     "Damage" (Bonus Action, no target): Dash, and the die on the next melee hit
 *                      this turn IF the fighter moved 5 feet in a straight line first — the player's
 *                      fact, so the die is a TICKED checkbox on the damage offer (the clock riders'
 *                      ruling). A chip until the end of the turn; the hit spends it.
 *   Feinting Attack    "Damage" (Bonus Action, one creature within 5 feet) and the pack's effect
 *                      "Feinting Attack" — "for tracking the target", says the pack, "it does not
 *                      automate the Advantage". The module puts that marker on the target with the
 *                      fighter as its source; the GATE reads it as Advantage for the fighter alone
 *                      (EFFECT_BENDS `only: "source"`), the fighter's next attack roll at that target
 *                      SPENDS it (the chip-spend receipt), and the die rides the hit's damage.
 *
 * The die is READ off the sheet — the activity's roll formula, or its damage part
 * (`@scale.battle-master.superiority.die`, resolved on the fighter) — and the POOL is the
 * system's: `use()` consumes the Superiority Die through the activity's own consumption. The
 * native follow-up of the two damage-typed uses (dnd5e would open a damage dialog) is switched
 * off at the use — the die belongs to the hit, not to the Bonus Action. Membership is the
 * Superiority Uses list. Nothing here counts turns: the chips wear the platform's clocks.
 * ------------------------------------------------------------------------------------------- */

const listed = () => listedNames(superiorityUseEntries());
const { rowNamed } = tableIndex(SUPERIORITY_USES);
const useRowFor = activity => {
  const row = rowNamed(activity?.item?.name);
  if ( !row || !listed().has(lower(row.key)) ) return null;
  return (lower(activity.name) === lower(row.use)) ? row : null;
};

/** The Superiority Die as this activity names it — its roll formula, or its damage part — resolved on the actor. "d8" reads as "1d8". */
function dieOf(actor, activity) {
  const part = activity?.damage?.parts?.[0];
  const raw = activity?.roll?.formula || (part ? riderPartFormula({ number: part.number, denomination: part.denomination, custom: part.custom, bonus: part.bonus }) : null);
  return resolveDie(actor, raw);
}

/** The fighter's standing use-chip for a row, or null. */
const chipFor = (actor, key) => actor?.effects?.find(e => (e.getFlag(MODULE_ID, CHIP_FLAG) === "use") && (e.getFlag(MODULE_ID, "useKey") === key)) ?? null;

/* --- the use: the native follow-up off, the consequence on ---------------------------------- */

// ⚠ THE CAST SLICE MUST NOT APPLY A MANEUVER'S EFFECTS. Bait and Switch ships TWELVE "Baited AC"
// effects (one per face of the die) on its utility activity, and the cast slice — reading a
// utility with effects and a target — applied all twelve to the Ranger (AC 13 → 91, first live
// run). Evasive Footwork's "Evasive AC" is a changeless placeholder. Every maneuver's consequence
// is this machine's (or the hit menu's, or the hold's), so the birth stamp polish.js writes is
// removed here, one hook later, for every Battle Master maneuver card.
Hooks.on("preCreateChatMessage", doc => {
  try {
    const isUsage = (doc.type === "usage") || (doc.getFlag("dnd5e", "messageType") === "usage");
    if ( !isUsage || !doc.getFlag(MODULE_ID, "castApply") ) return;
    const item = resolveUuid(doc.getFlag("dnd5e", "item")?.uuid ?? "");
    if ( !item || (item.type !== "feat") || !MANEUVER_FEATURE_NAMES.has(lower(item.name)) ) return;
    doc.updateSource({ [`flags.${MODULE_ID}.-=castApply`]: null });
  } catch(err) { console.warn(`${TITLE} | Could not keep the cast slice off a maneuver's card.`, err); }
});

// A damage-typed use (Feinting, Lunging) would be followed by dnd5e's own damage dialog — the
// die is the HIT's, not the Bonus Action's, so the follow-up is switched off at the use.
Hooks.on("dnd5e.preUseActivity", (activity, usageConfig) => {
  try {
    if ( useRowFor(activity) && (activity.type === "damage") ) usageConfig.subsequentActions = false;
  } catch(err) { console.warn(`${TITLE} | Could not claim a maneuver's use.`, err); }
});

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  try {
    const row = useRowFor(activity);
    if ( !row ) return;
    const actor = activity.actor;
    if ( !actor?.isOwner ) return;
    const message = (results?.message instanceof ChatMessage) ? results.message : null;
    if ( !message || message.getFlag(MODULE_ID, "superiorityUse") ) return;
    void drive(row, activity, actor, message);
  } catch(err) {
    console.error(`${TITLE} | A maneuver's use failed — apply it by hand.`, err);
  }
});

async function drive(row, activity, actor, message) {
  const item = activity.item;
  const die = dieOf(actor, activity);
  const targets = (message.getFlag("dnd5e", "targets") ?? []).map(t => ({ uuid: t.uuid, name: t.name }));
  const base = { ...statContext(actor.uuid), key: row.key, die, rule: row.rule, itemImg: item.img ?? null };
  if ( row.bonus ) {
    // Evasive Footwork: the die rolled in the open, the number on the sheet until the start of the next turn.
    const roll = die ? await new Roll(die).evaluate() : null;
    if ( roll ) await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${item.name} — the die` });
    const stale = actor.effects.filter(e => (e.getFlag(MODULE_ID, CHIP_FLAG) === "use") && (e.getFlag(MODULE_ID, "useKey") === row.key));
    if ( stale.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id));
    const clock = chipClock(row.bonus.window, placeOf(actor));
    const effect = roll ? await ActiveEffect.implementation.create({
      name: item.name, img: item.img ?? "icons/svg/shield.svg",
      description: `<p><em>“${row.rule}”</em></p><p>Written by Battle Flow when ${item.name} was used: ${row.bonus.what} +${roll.total} until the start of ${actor.name}'s next turn.</p>`,
      origin: item.uuid, disabled: false, transfer: false,
      changes: [{ key: row.bonus.key, mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: String(roll.total) }],
      ...(clock ? chipData(clock) : {}),
      flags: { [MODULE_ID]: { [CHIP_FLAG]: "use", useKey: row.key } }
    }, { parent: actor }) : null;
    await message.setFlag(MODULE_ID, "superiorityUse", { ...base, total: roll?.total ?? null, effectId: effect?.id ?? null,
      line: roll ? `${row.bonus.what} +${roll.total} until the start of your next turn` : "the die could not be read — apply the bonus by hand" });
    return;
  }
  if ( row.choice ) {
    // Bait and Switch: the die rolled now; WHO wears it is the fighter's choice (a popup with the
    // hold family's clock, the fighter by default); the pack's own "+N" effect is applied on the answer.
    const roll = die ? await new Roll(die).evaluate() : null;
    if ( roll ) await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${item.name} — the die` });
    const other = targets.find(t => t.uuid !== actor.uuid) ?? null;
    const options = [{ uuid: actor.uuid, name: actor.name }, ...(other ? [other] : [])];
    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    await message.setFlag(MODULE_ID, "superiorityUse", { ...base, total: roll?.total ?? null,
      line: roll ? `${row.choice.what} +${roll.total} until the start of your next turn — yours or the other creature's` : "the die could not be read — apply the bonus by hand" });
    if ( !roll ) return;
    // ⚠ `rule` rides this flag too: the popup and the card quote it (a first live run printed “undefined”).
    await message.setFlag(MODULE_ID, "baitSwitch", { ...statContext(actor.uuid), status: "pending", key: row.key, rule: row.rule, itemUuid: item.uuid, itemImg: item.img ?? null,
      total: roll.total, effectName: `${row.choice.effectPrefix}${roll.total}`, options, chosen: null, resolved: null,
      ...(window && other ? { window, deadline: Date.now() + (window * 1000) } : {}) });
    // Nobody else to choose: the fighter wears it, no question asked.
    if ( !other ) await chooseBait(message, actor.uuid);
    return;
  }
  if ( row.chip ) {
    // Lunging Attack: a chip until the end of the turn; the next melee hit's offer ticks the die.
    const stale = actor.effects.filter(e => (e.getFlag(MODULE_ID, CHIP_FLAG) === "use") && (e.getFlag(MODULE_ID, "useKey") === row.key));
    if ( stale.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id));
    const clock = chipClock(row.chip.window, placeOf(actor));
    await ActiveEffect.implementation.create({
      name: item.name, img: item.img ?? "icons/svg/aura.svg",
      description: `<p><em>“${row.rule}”</em></p><p>Written by Battle Flow when ${item.name} was used; the next melee hit this turn may add the die.</p>`,
      origin: item.uuid, disabled: false, transfer: false,
      ...(clock ? chipData(clock) : {}),
      flags: { [MODULE_ID]: { [CHIP_FLAG]: "use", useKey: row.key, die } }
    }, { parent: actor });
    await message.setFlag(MODULE_ID, "superiorityUse", { ...base, line: `Dash; the ${die ?? "die"} rides the next melee hit this turn — ${row.rider.caveat}` });
    return;
  }
  if ( row.marker ) {
    // Feinting Attack: the pack's marker on the target, the fighter as its source.
    const effect = [...(activity.effects ?? [])].map(e => e.effect).find(e => e && (lower(e.name) === lower(row.marker.effect)))
      ?? item.effects.find(e => lower(e.name) === lower(row.marker.effect)) ?? null;
    const target = targets.find(t => t.uuid !== actor.uuid) ?? null;
    if ( !effect || !target ) {
      await message.setFlag(MODULE_ID, "superiorityUse", { ...base, line: !target ? "no creature targeted — target the creature to feint, then use it again" : "the pack's marker is missing from the sheet — feint by hand" });
      return;
    }
    await applyEffectsWithReceipt(message, [effect], [target], { source: actor.uuid, marker: "feintDone" });
    await message.setFlag(MODULE_ID, "superiorityUse", { ...base, target: target.name,
      line: `Advantage on your next attack roll against ${target.name} this turn; the ${die ?? "die"} rides that hit` });
  }
}

/* --- Bait and Switch: the choice (the moment spine) ------------------------------------------- */

async function chooseBait(card, uuid) {
  const flag = card.getFlag(MODULE_ID, "baitSwitch");
  if ( !flag || flag.chosen || !flag.options?.some(o => o.uuid === uuid) ) return;
  await queueFlagWrite(card, "baitSwitch", current => {
    if ( current.chosen ) return false;
    current.chosen = uuid;
    current.answeredAt = Date.now();
  });
}

async function showBaitPopup(card) {
  const bs = card.getFlag(MODULE_ID, "baitSwitch");
  if ( !bs || bs.chosen ) return;
  const actor = resolveUuid(bs.sourceUuid);
  const item = resolveUuid(bs.itemUuid);
  await openMomentPopup(card, "bait", actor, {
    title: `${bs.key} — ${actor?.name ?? ""}`, icon: "fa-solid fa-people-arrows",
    content: bfCard({ img: item?.img ?? null, eyebrow: `Maneuver — ${bs.key}`, tone: "pending",
      title: `The die rolled ${bs.total} — who gains the AC?`,
      subtitle: `${spendPhrase(poolSpendsOn(card))} · AC +${bs.total} until the start of your next turn`,
      lines: [ruleLine(bs.rule)] }) + holdBarHTML(bs, "to answer"),
    buttons: bs.options.map((o, i) => ({ action: `pick-${i}`, label: `${o.name} (+${bs.total} AC)`, default: i === 0, callback: () => chooseBait(card, o.uuid) }))
  });
}

const baitTimers = new Map();
function armBaitTimer(card) {
  const bs = card.getFlag(MODULE_ID, "baitSwitch");
  if ( !bs || bs.chosen || !bs.deadline || !drivesMomentFor(bs.sourceUuid ?? null) ) { disarmDeadline(baitTimers, card.id); return; }
  armDeadline(baitTimers, card.id, bs.deadline, async id => {
    try {
      const c = game.messages.get(id);
      if ( !c ) return;
      await queueFlagWrite(c, "baitSwitch", current => {
        if ( current.chosen || !current.deadline || (current.deadline > Date.now()) ) return false;
        current.chosen = current.options?.[0]?.uuid ?? null;   // the fighter, by default
        current.timedOut = true;
        current.answeredAt = Date.now();
      });
    } catch(err) { console.error(`${TITLE} | The Bait and Switch buzzer failed.`, err); }
  });
}

const baitRuns = new Set();
async function settleBait(card) {
  const bs = card.getFlag(MODULE_ID, "baitSwitch");
  if ( !bs?.chosen || bs.resolved || baitRuns.has(card.id) ) return;
  if ( !drivesMomentFor(bs.sourceUuid ?? null) ) return;
  baitRuns.add(card.id);
  try {
    let claimed = false;
    await queueFlagWrite(card, "baitSwitch", current => { if ( current.resolved || current.resolving ) return false; current.resolving = true; claimed = true; });
    if ( !claimed ) return;
    const item = bs.itemUuid ? await fromUuid(bs.itemUuid) : null;
    const effect = item?.effects.find(e => lower(e.name) === lower(bs.effectName)) ?? null;
    const who = bs.options.find(o => o.uuid === bs.chosen) ?? null;
    if ( effect && who ) await applyEffectsWithReceipt(card, [effect], [{ uuid: who.uuid, name: who.name }], { source: bs.sourceUuid ?? null, marker: "baitDone" });
    await queueFlagWrite(card, "baitSwitch", current => { current.resolving = false; current.resolved = { name: who?.name ?? null, applied: !!(effect && who), effectName: bs.effectName }; });
  } catch(err) {
    console.error(`${TITLE} | Bait and Switch failed to apply — apply the AC bonus by hand.`, err);
  } finally {
    baitRuns.delete(card.id);
  }
}

Hooks.on("updateChatMessage", message => { if ( message.getFlag(MODULE_ID, "baitSwitch")?.chosen ) void settleBait(message); });

/* --- the offer: Lunging Attack's die is a ticked checkbox (the player's fact) ---------------- */

const lungingRow = () => { const k = Object.keys(SUPERIORITY_USES).find(x => SUPERIORITY_USES[x].chip && SUPERIORITY_USES[x].rider); return k ? { key: k, ...SUPERIORITY_USES[k] } : null; };
function lungeFor(attackMessage, activity) {
  const row = lungingRow();
  if ( !row || !listed().has(lower(row.key)) ) return null;
  const attacker = activity?.actor;
  if ( !attacker || (activity.attack?.type?.value !== "melee") ) return null;
  const chip = chipFor(attacker, row.key);
  if ( !chip ) return null;
  const die = chip.getFlag(MODULE_ID, "die") ?? null;
  const type = [...(activity.item?.system?.damage?.base?.types ?? [])][0] ?? null;
  return { row, chip, die, type, attacker };
}

registerOfferPart({
  key: "lunge",
  due: (attackMessage, activity) => { try { return !!lungeFor(attackMessage, activity)?.die; } catch { return false; } },
  parts: (attackMessage, activity) => {
    const l = lungeFor(attackMessage, activity);
    if ( !l ) return null;
    let ticked = !!l.die;
    return {
      // The tick, the name and the dice, then the fold — nothing above the rule (user, 2026-09-05).
      html: l.die ? riderMenuHTML([{ key: "lunge", label: l.row.key, formula: l.die, type: l.type, why: l.row.rider.caveat, rule: l.row.rule }]) : "",
      lines: l.die ? [] : [`<strong>${l.row.key}</strong> stands, but its die could not be read off the sheet — add it by hand.`],
      wire(element) {
        const box = element?.querySelector('input[name="bf-rider"][value="lunge"]');
        if ( box ) box.addEventListener("change", () => { ticked = box.checked; });
      },
      async commit() {
        try { await attackMessage.setFlag(MODULE_ID, "lungePick", ticked); }
        catch(err) { console.error(`${TITLE} | Could not record the Lunging Attack pick.`, err); }
      }
    };
  }
});

/* --- the rider: the die rides the hit's damage roll ---------------------------------------- */

Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
  try {
    const activity = config.subject;
    if ( activity?.type !== "attack" ) return;
    const attackMessage = attackMessageForDamage(config, message);
    if ( !attackMessage ) return;
    const attacker = activity.actor;
    if ( !attacker ) return;
    const names = listed();
    const type = [...(activity.item?.system?.damage?.base?.types ?? [])][0] ?? null;
    const push = formula => config.rolls.push({ data: config.rolls[0]?.data ?? {}, parts: [formula], options: { type, types: type ? [type] : [] } });
    const rode = [];
    // Lunging: the chip on the attacker, a melee hit, the offer's tick (absent: rides).
    const lunge = lungeFor(attackMessage, activity);
    if ( lunge?.die && (attackMessage.getFlag(MODULE_ID, "lungePick") !== false) ) {
      push(lunge.die);
      rode.push({ key: lunge.row.key, formula: lunge.die, type, why: lunge.row.rider.caveat, rule: lunge.row.rule });
      void lunge.chip.delete().catch(() => {});
    }
    // Feinting: the marker on EVERY hit target from this attacker (one roll serves them all), or
    // the spend the attack roll already recorded (the gate's receipt goes first, the marker second).
    for ( const [key, row] of Object.entries(SUPERIORITY_USES) ) {
      if ( !row.marker || !names.has(lower(key)) ) continue;
      const hits = hitTargets(attackMessage);
      if ( !hits.length ) continue;
      const spent = attackMessage.getFlag(MODULE_ID, "chipSpend")?.spent ?? [];
      const feinted = hits.every(t => {
        const target = resolveUuid(t.uuid);
        const marker = target?.effects?.find(e => (lower(e.name) === lower(row.marker.effect)) && (e.getFlag(MODULE_ID, "sourceUuid") === attacker.uuid));
        return !!marker || spent.some(s => (lower(s.name) === lower(row.marker.effect)) && (s.uuid === t.uuid));
      });
      if ( !feinted ) continue;
      const feat = featureNamed(attacker, key);
      const act = activityNamed(feat, row.use);
      const die = act ? dieOf(attacker, act) : null;
      if ( !die ) continue;
      push(die);
      rode.push({ key, formula: die, type, why: `the feint at ${hits.map(t => t.name).join(", ")}`, rule: row.rule });
      // ⚠ The marker is NOT deleted here: the attack roll SPENDS it through the chip-spend
      // machine (EFFECT_BENDS `spend: "attack"`, the receipt first, the document second), and a
      // second delete here raced it (measured: "ActiveEffect does not exist", first live run).
    }
    if ( rode.length ) foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.superiorityRide`, { ...statContext(attacker.uuid), attackId: attackMessage.id, rode });
  } catch(err) {
    console.error(`${TITLE} | A maneuver's die failed to ride — add it by hand.`, err);
  }
});

/* --- the cards say it (R5) -------------------------------------------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const su = message.getFlag(MODULE_ID, "superiorityUse");
  if ( su ) {
    const line = document.createElement("div");
    // The maneuver card's one shape (user, 2026-09-05: "the same UI language and design as
    // Riposte"): the feature's art, `Maneuver — Name`, `Name — what happened`, who and the cost.
    // The spend, worded the one way (spendPhrase — the flash and the card line say the same).
    const spend = spendPhrase(poolSpendsOn(message));
    line.innerHTML = bfCard({ img: su.itemImg ?? null, eyebrow: `Maneuver — ${su.key}`, tone: su.die ? "good" : "neutral",
      title: su.total !== undefined && su.total !== null ? `${su.key} — the die rolled ${su.total}` : `${su.key} — ${su.die ?? "the die"} armed`,
      subtitle: `${spend}${su.line ? ` · ${su.line}` : ""}`, lines: [ruleLine(su.rule)] });
    html.querySelector(".message-content")?.appendChild(line);
  }
  const bs = message.getFlag(MODULE_ID, "baitSwitch");
  if ( bs ) {
    const chosenName = bs.options?.find(o => o.uuid === bs.chosen)?.name ?? null;
    const fighterName = bs.options?.[0]?.name ?? "the fighter";
    const line = document.createElement("div");
    line.innerHTML = bfCard({ img: bs.itemImg ?? null, eyebrow: `Maneuver — ${bs.key}`, tone: bs.resolved ? "good" : "pending",
      title: bs.resolved ? `${bs.key} — ${bs.resolved.name ?? chosenName} gains AC +${bs.total}${bs.timedOut ? " (timer — the fighter)" : ""}${bs.resolved.applied ? "" : "; the pack's effect was not found — apply it by hand"}`
        : chosenName ? `${bs.key} — ${chosenName} gains AC +${bs.total}` : `${bs.key} — who gains AC +${bs.total}?`,
      subtitle: `${spendPhrase(poolSpendsOn(message))}${bs.resolved ? ` · until the start of ${fighterName}'s next turn` : ""}`,
      lines: [ruleLine(bs.rule)] }) + ((!bs.chosen && bs.deadline) ? holdBarHTML(bs, "to answer") : "");
    html.querySelector(".message-content")?.appendChild(line);
    const actor = resolveUuid(bs.sourceUuid);
    if ( !bs.chosen && canAnswerFor(actor) ) {
      const shownKey = popupKey(message.id, "bait");
      if ( !shownMoments.has(shownKey) ) { shownMoments.add(shownKey); void showBaitPopup(message); }
      line.appendChild(momentButton(`Answer — ${bs.key}`, () => void showBaitPopup(message)));
    }
    armBaitTimer(message);
    if ( bs.chosen ) void settleBait(message);   // the resume floor
  }
  const sr = message.getFlag(MODULE_ID, "superiorityRide");
  if ( sr?.rode?.length ) {
    for ( const r of sr.rode ) {
      const line = document.createElement("div");
      line.innerHTML = bfCard({ eyebrow: `Maneuver — ${r.key}`, tone: "good", title: `${r.key} — ${r.formula}${r.type ? ` ${r.type}` : ""} rode this roll`, subtitle: r.why, lines: [ruleLine(r.rule)] });
      html.querySelector(".message-content")?.appendChild(line);
    }
  }
});
