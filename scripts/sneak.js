/**
 * Battle Flow — Sneak Attack, cunningly: the dice ride the damage, the costs come off first, the effects go through the saves machine, once per turn is a chit.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, activeCombatFor, drivesMomentFor, queueFlagWrite, statContext } from "./core.js";
import { verdictsOn } from "./decide/demand.js";
import { lower, featureNamed } from "./lookup.js";
import { registerResumable } from "./ui.js";
import { damagePartsOf, hitTargets, statSourceOf, withTargets, writeTurnChit } from "./shared.js";
import { bfCard, cunningMenuHTML, ruleLine } from "./decide/present.js";
import { CUNNING_OPTIONS, DEATH_STRIKE } from "./decide/registry.js";
import { cunningMenu, cunningPick, sneakFormula } from "./decide/sneak.js";
import { tokenForUuid } from "./geometry.js";
import { attackMessageForDamage, registerOfferPart } from "./auto-damage.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { applyEffectsWithReceipt } from "./effect-riders.js";

/* ---------------------------------------------------------------------------------------------
 * SNEAK ATTACK (user, 2026-09-02 — the prototype *Sneak Attack, Cunningly*, "go with the
 * prototype and iterate"). Two surfaces, both already there:
 *
 *   THE GATE (reminders.js) — the Sneak Attack box under the sources, a checkbox: the PLAYER
 *   decides whether the conditions hold; the module says what it read. The press stamps
 *   `flags.<module>.sneak` on the attack message — armed or not, the dice, the weapon's type.
 *
 *   THE DAMAGE OFFER (auto-damage.js) — opened for an armed Sneak Attack even under auto damage,
 *   because there is a decision pending: WHICH Cunning Strike effects, if any. The menu is read
 *   off the sheet (CUNNING_OPTIONS — the feature that grants each row, subclass included); the
 *   pick is written back onto the attack message BEFORE the dice ("You remove the die before
 *   rolling"), and the roll goes out through the one function every offer rolls with.
 *
 * Then this file: the RIDER at `preRollDamageV2` (the hit-riders seam) pushes what is left of
 * the sneak dice as its own part — the weapon's type, crit-doubled for free by the same stamp
 * that doubles the weapon's dice — and marks the arm rolled and the turn spent (the chit); the
 * EFFECTS after the damage lands `use()` the pack's own save activities at the hit target, so
 * the demand, the timer, the roll and the failed-save press are the saves machine's; a LINE
 * option (Withdraw, Stealth Attack) is a line on the damage card. Two follow-ups ride the
 * demand card's own verdict (Envenom Weapons' Poisoned on top of its damage; Death Strike's
 * doubled damage), applied on the elect through the same two appliers everything else uses.
 *
 * WHERE IT RUNS: the rider and the effects on the ROLLER's client (the damage hooks fire where
 * the dice are rolled — the roller owns the rogue and its items, so `use()` is theirs to
 * call); the follow-ups on the flow elect, off the card. Nothing crosses the wire.
 * ------------------------------------------------------------------------------------------- */

/**
 * The activity on an item by name — one name, or a list in order of preference where the
 * first with a use left wins (Rend Mind's free use before its three-dice use).
 */
function activityNamed(item, names) {
  const wanted = (Array.isArray(names) ? names : [names]).map(lower);
  const all = [...(item?.system?.activities ?? [])];
  for ( const n of wanted ) {
    const a = all.find(x => lower(x.name) === n);
    if ( !a ) continue;
    const max = a.uses?.max;
    if ( (max === "" || max === null || max === undefined) || ((a.uses?.value ?? 0) > 0) ) return a;
  }
  return null;
}

/** The Cunning Strike DC: the activity's own computed value where one exists, else the rule's arithmetic. */
function cunningDC(actor, activity = null) {
  const own = Number(activity?.save?.dc?.value);
  if ( own > 0 ) return own;
  return 8 + (actor?.system?.attributes?.prof ?? 0) + (actor?.system?.abilities?.dex?.mod ?? 0);
}

/** The armed, not-yet-rolled Sneak Attack on an attack message, or null. */
export function sneakArmedOn(attackMessage) {
  const s = attackMessage?.getFlag(MODULE_ID, "sneak");
  return (s?.armed && !s.rolled) ? s : null;
}

/**
 * What the damage offer shows for an armed Sneak Attack, and what it does at fire time. The
 * pick lives in memory (`chosen`) from the checkboxes' change events, so the buzzer — which
 * fires as the dialog is closing — commits what was ticked without reading a DOM that may be
 * gone. `wire` also keeps the pick legal as it is made (at most `max`) and names the formula on
 * the button.
 * @param {ChatMessage} attackMessage
 * @param {object} activity   the attack activity (for the weapon's own formula on the button)
 */
function sneakOfferParts(attackMessage, activity) {
  const sneak = sneakArmedOn(attackMessage);
  if ( !sneak ) return null;
  const attacker = attackMessage.getAssociatedActor();
  if ( !attacker ) return null;
  const features = attacker.items.filter(i => i.type === "feat").map(i => i.name);
  const { rows, max } = cunningMenu({ options: CUNNING_OPTIONS, features, weaponName: sneak.weaponName ?? activity?.item?.name ?? "", dice: sneak.number });
  const csItem = featureNamed(attacker, "Cunning Strike");
  const dc = cunningDC(attacker, csItem ? activityNamed(csItem, "Poison") : null);
  const chosen = new Set();
  const formulaLabel = () => {
    const pick = cunningPick({ rows, chosen, dice: sneak.number, max });
    const left = sneakFormula({ number: sneak.number, faces: sneak.faces, cost: pick.cost });
    // THE WEAPON IS ON THE BUTTON TOO (user walk 2026-09-02: "that roll button makes it look
    // like it's only sneak attack") — the roll is the weapon's dice plus the sneak dice.
    const weapon = activity?.item?.name ?? "Weapon";
    return left ? `${weapon} + Sneak Attack ${left}` : `${weapon} alone — every Sneak Attack die forgone`;
  };
  return {
    sneak, rows, max, dc,
    line: `<strong>Sneak Attack</strong> — ${sneak.dice} rides this roll, once per turn${rows.length ? "; pick a Cunning Strike below, or roll them all" : ""}.`,
    html: cunningMenuHTML({ rows, max, dc, dice: sneak.dice }),
    /** Keep the pick legal and the button honest, live. */
    wire(element) {
      const boxes = [...(element?.querySelectorAll('input[name="bf-cunning"]') ?? [])];
      const button = element?.querySelector('button[data-action="roll"]');
      const baseLabel = button?.textContent?.trim() ?? "Roll Damage";
      const relabel = () => { if ( button ) button.innerHTML = `<i class="fa-solid fa-dice-d6" inert></i> ${baseLabel} — ${formulaLabel()}`; };
      const order = [];
      for ( const box of boxes ) {
        box.addEventListener("change", () => {
          if ( box.checked ) {
            chosen.add(box.value); order.push(box.value);
            // Past the limit, or past the dice: the OLDEST pick gives way — the rules allow one
            // (two with Improved Cunning Strike), and the dice must pay for all of them.
            while ( (chosen.size > max) || cunningPick({ rows, chosen, dice: sneak.number, max }).tooDear ) {
              const oldest = order.shift();
              if ( !oldest ) break;
              chosen.delete(oldest);
              const el = boxes.find(b => b.value === oldest);
              if ( el ) el.checked = false;
            }
          } else {
            chosen.delete(box.value);
            const at = order.indexOf(box.value);
            if ( at >= 0 ) order.splice(at, 1);
          }
          relabel();
        });
      }
      relabel();
    },
    /** Write the pick on the attack message BEFORE the roll — the rider reads it there. */
    async commit() {
      const pick = cunningPick({ rows, chosen, dice: sneak.number, max });
      const keys = (pick.tooMany || pick.tooDear) ? [] : pick.chosen.map(r => r.key);
      try {
        await attackMessage.setFlag(MODULE_ID, "sneak", { ...sneak, cunning: keys, cost: keys.length ? pick.cost : 0, dc });
      } catch(err) {
        console.error(`${TITLE} | Could not record the Cunning Strike pick — rolling the full Sneak Attack.`, err);
      }
    }
  };
}

// Declared into the damage offer (auto-damage.js `registerOfferPart`, 2026-09-04): an armed Sneak
// Attack opens the offer whatever the auto-damage setting (user, 2026-09-02: "even with auto
// damage on, because there is a decision to make"), and paints the Cunning Strike menu on it.
registerOfferPart({
  key: "sneak",
  due: attackMessage => !!sneakArmedOn(attackMessage),
  parts: (attackMessage, activity, { isCritical }) => {
    const sneak = sneakOfferParts(attackMessage, activity);
    if ( !sneak ) return null;
    return {
      html: sneak.html,
      lines: [`${sneak.line}${isCritical ? " A critical hit doubles what is left of the sneak dice too." : ""}`],
      wire: sneak.wire, commit: sneak.commit
    };
  }
});

/* --- the rider: the sneak dice ride the weapon's damage roll --------------------------------- */

Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
  try {
    const activity = config.subject;
    if ( activity?.type !== "attack" ) return;
    const attackMessage = attackMessageForDamage(config, message);
    const sneak = attackMessage ? sneakArmedOn(attackMessage) : null;
    if ( !sneak ) return;
    const attacker = activity.actor;
    const cost = Number(sneak.cost) || 0;
    const formula = sneakFormula({ number: sneak.number, faces: sneak.faces, cost });
    if ( formula ) {
      config.rolls.push({
        // No `properties`: the sneak dice are the weapon's type but not its magic — they must
        // not inherit the flags that decide physical-resistance bypass (hit-riders' rule).
        data: config.rolls[0]?.data ?? {},
        parts: [formula],
        options: { type: sneak.type ?? null, types: sneak.type ? [sneak.type] : [] }
      });
    }
    const chosen = (sneak.cunning ?? []).map(key => ({ key, ...CUNNING_OPTIONS[key] })).filter(r => r.feature);
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.sneakDamage`, {
      ...statContext(attacker?.uuid ?? null),
      attackId: attackMessage.id, dice: sneak.dice, formula, cost, dc: sneak.dc ?? null,
      cunning: chosen.map(r => ({ key: r.key, label: r.activity ?? r.rule.split(" (")[0], line: !r.activity, rule: r.rule }))
    });
    // Once per turn, spent by dealing the damage: the arm is consumed on the attack message
    // (the card's Damage button pressed twice must not ride twice) and the chit is written on
    // the attacker for the turn in progress (out of combat there is no turn — no chit).
    void attackMessage.setFlag(MODULE_ID, "sneak", { ...sneak, rolled: true })
      .catch(err => console.warn(`${TITLE} | Could not mark the Sneak Attack rolled.`, err));
    void writeTurnChit(attacker, "sneak", {
      name: "Sneak Attack — used this turn", img: featureNamed(attacker, "Sneak Attack")?.img ?? null,
      description: "Sneak Attack has been dealt this turn. Once per turn; this chit ends with the turn.",
      origin: activity.item?.uuid ?? null
    }).catch(err => console.warn(`${TITLE} | Could not write the Sneak Attack chit.`, err));
  } catch(err) {
    console.error(`${TITLE} | Sneak Attack dice failed to ride — roll them by hand.`, err);
  }
});

/* --- the effects: the pack's own save activities, at the hit target, after the damage -------- */

/** Same-client latch: the effects run once per damage message. */
const effectsRun = new Set();

// The damage message LANDING is the trigger, on the client that AUTHORED it — the roller's,
// which owns the rogue and its items and can `use()` them. (`dnd5e.rollDamageV2` hands over
// the rolls and the activity but not reliably the message; the creation hook does, everywhere.)
Hooks.on("createChatMessage", message => {
  if ( !message.isAuthor ) return;
  const sd = message.getFlag(MODULE_ID, "sneakDamage");
  if ( !sd || sd.effectsDone || effectsRun.has(message.id) ) return;
  effectsRun.add(message.id);
  void runCunningEffects(message, sd, null);
});

async function runCunningEffects(damageMessage, sd, activity) {
  try {
    const attackMessage = game.messages.get(sd.attackId);
    const attacker = activity?.actor ?? attackMessage?.getAssociatedActor();
    if ( !attackMessage || !attacker ) return;
    const hits = hitTargets(attackMessage);
    const tokens = hits.map(t => tokenForUuid(t.uuid)).filter(Boolean);
    const stamps = [];
    const useAt = async (item, activity, stamp) => {
      if ( !item || !activity ) return;
      const results = await withTargets(tokens, () => activity.use({}, { configure: false }, {}));
      const card = results?.message;
      if ( card instanceof ChatMessage ) {
        await card.setFlag(MODULE_ID, "cunning", { ...statContext(attacker.uuid), attackId: attackMessage.id,
          // ⚠ `applied` is an ARRAY of uuids, never a uuid-keyed map: a flag's dotted keys are
          // expanded into paths on write (the saves machine's own ground truth), so a map keyed
          // "Actor.x" never reads back — measured 2026-09-02 as the follow-up applying in a loop.
          damageId: damageMessage.id, attackerName: attacker.name, applied: [], ...stamp });
      }
    };
    for ( const pick of (sd.cunning ?? []) ) {
      const row = CUNNING_OPTIONS[pick.key];
      if ( !row || !row.activity ) continue;           // a line option — the card says it
      const upgrade = row.upgrade && featureNamed(attacker, row.upgrade.feature) ? row.upgrade : null;
      const item = featureNamed(attacker, upgrade ? upgrade.feature : row.feature);
      const act = activityNamed(item, upgrade ? upgrade.activity : row.activity);
      if ( !act ) { stamps.push(`${pick.label}: no activity on the sheet`); continue; }
      // Envenom Weapons' Poison carries the damage and no condition: the failure also presses
      // the Cunning Strike item's own Poisoned effect, through the follow-up below.
      let effectUuid = null;
      if ( upgrade?.onFail === "poisoned" ) {
        const from = featureNamed(attacker, upgrade.effectFrom ?? row.feature);
        effectUuid = from?.effects?.find(e => e.statuses?.has?.("poisoned"))?.uuid ?? null;
      }
      await useAt(item, act, { key: pick.key, label: pick.label, rule: row.rule,
        ...(upgrade?.onFail ? { onFail: upgrade.onFail, effectUuid, upgradeRule: upgrade.rule } : {}) });
    }
    // DEATH STRIKE (the Assassin): a Sneak Attack hit on the first round of a combat demands a
    // Constitution save, or the attack's damage is doubled. Not an option — the clock decides.
    const deathStrike = featureNamed(attacker, DEATH_STRIKE.feature);
    if ( deathStrike && (activeCombatFor(attacker)?.round === 1) ) {
      const act = activityNamed(deathStrike, DEATH_STRIKE.activity);
      await useAt(deathStrike, act, { key: "deathStrike", label: DEATH_STRIKE.feature, rule: DEATH_STRIKE.rule, onFail: "double" });
    }
    await damageMessage.setFlag(MODULE_ID, "sneakDamage", { ...sd, effectsDone: true, ...(stamps.length ? { notes: stamps } : {}) })
      .catch(() => { /* the latch above holds for this session */ });
  } catch(err) {
    console.error(`${TITLE} | Cunning Strike effects failed — use the feature's activity by hand.`, err);
  }
}

/* --- the follow-ups: what a FAILED cunning save applies on top of the activity's own ---------- */

/** Same-client latch per card+target. */
const followups = new Set();

async function settleCunningFollowups(card) {
  const cunning = card.getFlag(MODULE_ID, "cunning");
  const saves = card.getFlag(MODULE_ID, "saves");
  const verdicts = verdictsOn(saves);   // the answered targets, through the one reader (Stage 2)
  if ( !cunning?.onFail || !verdicts.length ) return;
  if ( !drivesMomentFor(saves.sourceUuid ?? null) ) return;
  for ( const t of verdicts ) {
    if ( (t.outcome !== "failed") || cunning.applied?.includes?.(t.uuid) ) continue;
    const key = `${card.id}|${t.uuid}`;
    if ( followups.has(key) ) continue;
    followups.add(key);
    try {
      let claimed = false;
      await queueFlagWrite(card, "cunning", current => {
        if ( !Array.isArray(current.applied) ) current.applied = [];
        if ( current.applied.includes(t.uuid) ) return false;
        current.applied.push(t.uuid);
        claimed = true;
      });
      if ( !claimed ) continue;
      const target = [{ uuid: t.uuid, name: t.name }];
      if ( cunning.onFail === "poisoned" ) {
        const effect = cunning.effectUuid ? await fromUuid(cunning.effectUuid) : null;
        if ( effect ) await applyEffectsWithReceipt(card, [effect], target, { source: statSourceOf(card) });
      } else if ( cunning.onFail === "double" ) {
        const dmg = game.messages.get(cunning.damageId);
        const damages = dmg ? damagePartsOf(dmg.rolls) : [];
        if ( damages.length ) await applyDamagesWithReceipt(card, target, damages, { note: "Death Strike — the attack's damage again" });
      }
    } catch(err) {
      console.error(`${TITLE} | Cunning Strike follow-up failed.`, err);
    } finally {
      followups.delete(key);
    }
  }
}

// The follow-up keyed on a failed save: on the answer's write and on reload, never at the card's
// birth (no verdict yet). Declared to the spine's resumable registry (Stage 3, 2026-09-05) — its
// updateChatMessage registration and its render-time resume line were this file's; the
// per-target latch and the claim through the serializer inside are unchanged.
registerResumable("cunning", {
  pending: (flag, _message, cause) => (cause !== "create") && !!flag.onFail,
  drives: (_flag, message) => drivesMomentFor(message.getFlag(MODULE_ID, "saves")?.sourceUuid ?? null),
  drive: settleCunningFollowups
});

/* --- the cards say it (R5) -------------------------------------------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const sd = message.getFlag(MODULE_ID, "sneakDamage");
  if ( sd ) {
    const picks = sd.cunning ?? [];
    const line = document.createElement("div");
    line.innerHTML = bfCard({
      eyebrow: "Sneak Attack", tone: sd.formula ? "good" : "neutral",
      title: sd.formula ? `${sd.formula} rode this roll` : `every die of ${sd.dice} forgone`,
      subtitle: picks.length
        ? `${sd.cost}d forgone for ${picks.map(p => p.label).join(" and ")}${sd.dc ? ` — save DC ${sd.dc}` : ""}`
        : `${sd.dice}, no Cunning Strike`,
      lines: [
        ...picks.filter(p => p.line).map(p => ruleLine(p.rule)),
        ...(sd.notes ?? []).map(n => `<span style="opacity:0.8;">${n}</span>`)
      ]
    });
    html.querySelector(".message-content")?.appendChild(line);
  }
  const cunning = message.getFlag(MODULE_ID, "cunning");
  if ( cunning ) {
    const line = document.createElement("div");
    line.innerHTML = bfCard({
      eyebrow: "Cunning Strike", tone: "neutral",
      title: `${cunning.label} — from ${cunning.attackerName ?? "the rogue"}’s Sneak Attack`,
      lines: [ruleLine(cunning.rule), cunning.upgradeRule ? ruleLine(cunning.upgradeRule) : null]
    });
    html.querySelector(".message-content")?.appendChild(line);
  }
});
