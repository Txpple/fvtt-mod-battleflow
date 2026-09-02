/**
 * Battle Flow — The reminder gate: what bends this attack roll, and what it nets to — BEFORE the dice.
 * Split from mastery.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, statContext } from "./core.js";
import { conditionEntries, reminderEntries } from "./settings.js";
import { chipSpentOnRecord, grantingActor, rollConfigFor } from "./shared.js";
import { bfCard, choiceRowHTML, modeButtons, ruleLine, situationalBonusHTML } from "./decide/present.js";
import { openMomentPopup } from "./ui.js";
import { CHIP_FLAG, chipIsDead, chipOwnedBy } from "./decide/chips.js";
import { CONDITION_BENDS, MASTERY_RULES } from "./decide/registry.js";
import { lengthUnitKey, tokenSamplePoints } from "./decide/geometry.js";
import { REMINDER_FLAG, conditionSources, modeTitle, netMode, proneSources, reminderRecord,
  reminderSource, resolutionLine, rollChoices, rolledWith } from "./decide/reminders.js";

/* ---------------------------------------------------------------------------------------------
 * THE GATE (HANDOFF Stage 2 + 3, user rulings 2026-09-01: "I don't want a rescue, I want
 * proactivity"; "if you have multiple sources of adv/disadv contending, it always nets to a
 * regular attack").
 *
 * When something this module can READ bends an attack roll — the attacker's own Vexed chip on
 * a target, a Sapped chip on the attacker, Prone on either side (with the 5-foot geometry), or
 * a row of the condition table — the system's roll dialog does not open. Battle Flow's popup
 * does, carrying the dialog's own controls (the concentration precedent: "the POPUP is the
 * configuration surface", user call 2026-08-16): every source, the net, the glossary's own
 * sentence on why, the dialog's own choices (attack mode, ammunition, mastery, roll mode), a
 * situational bonus, and Advantage / Normal / Disadvantage with the NET highlighted. The human
 * presses; the roll is re-issued with the press. Nothing here sets a mode (R-A).
 *
 * WHERE IT RUNS: on the roller's client — the pre-roll hook fires where the dice are rolled —
 * so it needs no elect and works with no GM connected. A GM rolling a Sapped goblin meets it
 * exactly as a player rolling a Vexed target does.
 *
 * WHAT IT NEVER TOUCHES: a roll whose caller suppressed the dialog (`configure: false`) — the
 * resolver's own rolls, the volley's rays, the riposte inside a fold, a macro, the suites, and
 * this file's own re-issue. No dialog, no gate. And a roll with NO USAGE CARD behind it — an API
 * roll, an enricher link in a journal — is not gated either: the card keys the popup (the popper
 * discipline) and links the re-issued attack back into the system's own chain. No card, no gate.
 * ⚠ dnd5e evaluates fast-forward keys AFTER this hook (buildConfigure: preRoll hooks, then
 * applyKeybindings), so a shift-clicked roll still reads `configure` undefined here and IS
 * gated — which is the whole point of a gate.
 *
 * The hook is TEMPLATED (dnd5e.preRoll<Name>V2) — pinned in check-hook-dispatch beside its
 * damage twin, and measured live (tools/probe-expiry.mjs, hookSurfaces).
 * ------------------------------------------------------------------------------------------- */

/** The Rules Glossary, "Advantage" (dnd5e.content24 / the premium PHB) — verbatim, law 8. */
const NET_RULE = "A roll can’t be affected by more than one Advantage, and Advantage and Disadvantage on the same roll cancel each other.";

Hooks.on("dnd5e.preRollAttackV2", (config, dialog, message) => {
  try {
    const activity = config.subject;
    if ( activity?.type !== "attack" ) return;
    if ( dialog?.configure === false ) return;       // no dialog, no gate — the re-issue included
    const attacker = activity.item?.actor;
    if ( !(attacker instanceof Actor) ) return;
    const enabled = new Set(reminderEntries().map(e => e.kind));
    if ( !enabled.size ) return;                      // the list is the switch
    const card = usageCardFor(config, message);
    if ( !card ) return;                              // no card, no gate — an API roll
    const sources = sourcesFor(attacker, enabled);
    if ( !sources.length ) return;
    void showGate({ activity, attacker, sources, config, dialog, message, card });
    return false;                                     // the veto: the popup is the dialog
  } catch(err) {
    console.error(`${TITLE} | Reminder gate failed — rolling natively.`, err);
  }
});

/**
 * The usage card this attack roll hangs off, read the three ways dnd5e carries it at pre-roll
 * time (review findings 2 and 12, 2026-09-01 — the gate never once found it before):
 *   - the card's Attack BUTTON passes only the click `event`; the id is derived in `buildPost`,
 *     AFTER this hook, from the button's enclosing `[data-message-id]` — so it is read here the
 *     same way;
 *   - the sheet/`use()` auto-roll passes it as a FLAT key, `"flags.dnd5e.originatingMessage"`,
 *     expanded only in `buildPost`;
 *   - a caller that expanded it already (the suites' older shape) has it nested.
 * Null when none of the three names a live message.
 */
function usageCardFor(config, message) {
  let id = null;
  try { id = config?.event?.target?.closest?.("[data-message-id]")?.dataset?.messageId ?? null; } catch { id = null; }
  id ??= message?.data?.["flags.dnd5e.originatingMessage"] ?? message?.data?.flags?.dnd5e?.originatingMessage ?? null;
  return id ? (game.messages.get(id) ?? null) : null;
}

/* --- reading the table ---------------------------------------------------------------------- */

/** The roller's own token for this actor: a controlled one first, else the first on the canvas. */
function attackerTokenOf(attacker) {
  const controlled = canvas.tokens?.controlled?.find(t => t.actor?.uuid === attacker.uuid);
  if ( controlled ) return controlled;
  try { return attacker.getActiveTokens?.(true, false)?.[0] ?? null; } catch { return null; }
}

/**
 * Every occupied square's center for a token, from its DOCUMENT — the authoritative position.
 * `tokenSamplePoints` reads the drawn object's center for a 1×1 body, and a drawn token lags
 * its document while it animates a move; a rule is judged where the token IS, not where it is
 * still walking from.
 */
function documentSquares(doc) {
  const grid = doc.parent?.grid?.size;
  if ( !grid ) return [];
  const w = Math.max(1, Math.round(doc.width ?? 1)), h = Math.max(1, Math.round(doc.height ?? 1));
  if ( (w === 1) && (h === 1) ) return [{ x: doc.x + grid / 2, y: doc.y + grid / 2 }];
  return tokenSamplePoints(doc);
}

/**
 * The shortest grid distance between two tokens, IN FEET — sample every occupied square of
 * each so a Large body counts from its nearest edge, let the scene's own grid do the measuring,
 * then convert the scene's units to feet through the system's own table. ⚠ `measurePath` answers
 * in the SCENE's units (review finding 5): on a 1.5 m grid two squares read "3", and the rule
 * is 5 FEET. Null when either side cannot be measured, or the scene's units cannot be read —
 * which the decision lists as "distance unknown" rather than guessing.
 */
function nearestFeet(a, b) {
  try {
    const pa = documentSquares(a.document), pb = documentSquares(b.document);
    if ( !pa.length || !pb.length ) return null;
    let best = Infinity;
    for ( const p of pa ) {
      for ( const q of pb ) {
        const d = canvas.grid.measurePath([p, q]).distance;
        if ( Number.isFinite(d) && (d < best) ) best = d;
      }
    }
    if ( !Number.isFinite(best) ) return null;
    const unit = lengthUnitKey(canvas.scene?.grid?.units ?? canvas.grid?.units);
    if ( !unit ) return null;
    const feet = (unit === "ft") ? best : dnd5e.utils.convertLength(best, unit, "ft", { strict: false });
    return Number.isFinite(feet) ? Math.round(feet * 10) / 10 : null;
  } catch {
    return null;
  }
}

/**
 * Every source this gate can read for the roll about to happen, in the order the table reads
 * them: the attacker's own state first, then each target's. Names are the TOKEN's where a token
 * is what was targeted — that is what the table calls it. A chip is live when the platform has
 * not marked it (decide/chips.js) AND no spend is already on record for it (shared.js) — a chip
 * a no-GM table could not delete is still spent.
 */
function sourcesFor(attacker, enabled) {
  const out = [];
  const attackerName = attacker.name;
  const live = e => !chipIsDead(e.duration ?? {}) && !chipSpentOnRecord(e);
  const conditions = enabled.has("condition") ? conditionEntries().map(e => e.kind) : [];
  const conditionFacts = { enabled: conditions, table: CONDITION_BENDS };

  // The attacker's own state.
  if ( enabled.has("sap") ) {
    for ( const e of attacker.effects ) {
      if ( (e.getFlag(MODULE_ID, CHIP_FLAG) !== "sap") || !live(e) ) continue;
      const by = grantingActor(e)?.name ?? null;
      out.push(reminderSource("sap", "disadvantage",
        `${attackerName} — ${e.name}${by ? ` by ${by}` : ""}`, MASTERY_RULES.sap));
    }
  }
  if ( enabled.has("prone") ) {
    out.push(...proneSources({ attackerProne: attacker.statuses?.has?.("prone"), attackerName }));
  }
  if ( conditions.length ) {
    out.push(...conditionSources({ ...conditionFacts, attackerStatuses: attacker.statuses ?? [], attackerName }));
  }

  // Each target.
  const attackerToken = attackerTokenOf(attacker);
  for ( const token of game.user.targets ) {
    const target = token.actor;
    if ( !target || (target.uuid === attacker.uuid) ) continue;
    const targetName = token.document?.name ?? target.name;
    if ( enabled.has("vex") ) {
      for ( const e of target.effects ) {
        if ( (e.getFlag(MODULE_ID, CHIP_FLAG) !== "vex") || !chipOwnedBy(e.origin, attacker.uuid) || !live(e) ) continue;
        out.push(reminderSource("vex", "advantage", `${attackerName} Vexed ${targetName}`, MASTERY_RULES.vex));
      }
    }
    if ( enabled.has("prone") && target.statuses?.has?.("prone") ) {
      const distanceFeet = attackerToken ? nearestFeet(attackerToken, token) : null;
      out.push(...proneSources({ targetProne: true, distanceFeet, targetName }));
    }
    if ( conditions.length ) {
      out.push(...conditionSources({ ...conditionFacts, targetStatuses: target.statuses ?? [], targetName }));
    }
  }
  return out;
}

/* --- the popup, and the re-issue ------------------------------------------------------------ */

const TONE_OF = { advantage: "good", disadvantage: "pending", normal: "neutral" };

/**
 * The native dialog's roll-mode select (public / private / blind / self), as one more choice
 * row — its options are the platform's, so this one is built at the EDGE. Null when the
 * platform offers fewer than two.
 */
function rollModeChoice(message) {
  try {
    const modes = (game.release.generation < 14) ? CONFIG.Dice.rollModes : CONFIG.ChatMessage.modes;
    const options = Object.entries(modes ?? {}).filter(([k]) => k !== "ic")
      .map(([value, l]) => ({ value, label: game.i18n.localize(l?.label ?? String(l)) }));
    if ( options.length < 2 ) return null;
    const current = message?.rollMode ?? game.settings.get("core", "rollMode");
    return { key: "rollMode", label: "Roll mode", options,
      value: options.some(o => o.value === current) ? current : options[0].value };
  } catch {
    return null;
  }
}

async function showGate({ activity, attacker, sources, config, dialog, message, card }) {
  const net = netMode(sources);
  const item = activity.item;
  const lines = [];
  for ( const s of sources ) {
    const bend = s.bend ? ` — <strong>${modeTitle(s.bend)}</strong>` : "";
    lines.push(`${s.label}${bend}`);
    if ( s.detail ) lines.push(ruleLine(s.detail));
  }
  lines.push(`<strong>Net: ${modeTitle(net)}.</strong> ${resolutionLine(sources)}`);
  if ( sources.length > 1 ) lines.push(ruleLine(NET_RULE));

  // THE DIALOG'S OWN CHOICES (user ruling 2026-09-01, review finding 14): what the native
  // dialog would have offered — attack mode, ammunition, mastery (decide/reminders.js) and the
  // roll mode — carried here, pre-set to what the roll would otherwise use in silence.
  const choices = rollChoices(dialog?.options ?? {}, config);
  const rollMode = rollModeChoice(message);
  if ( rollMode ) choices.push(rollMode);
  const selectName = key => `bf-reminder-${key}`;

  const reissue = async (mode, bonus, picks) => {
    // ⚠ THE CARD LINK IS WRITTEN HERE, EXPLICITLY (review finding 12). dnd5e derives
    // `originatingMessage` from the click event's enclosing card in `buildPost`, and the
    // re-issue has no click to derive it from — so at the table the re-issued attack was an
    // ORPHAN: the card's Damage button found no attack (a gated crit rolled un-doubled) and this
    // module's own chain walk missed it (no auto-apply, no rider). The raw event is deliberately
    // NOT forwarded: dnd5e re-reads its modifier keys off `config.event`, and an Alt-clicked
    // Attack whose human pressed Disadvantage would have rolled NORMAL.
    const data = foundry.utils.expandObject(foundry.utils.deepClone(message?.data ?? {}));
    foundry.utils.setProperty(data, "flags.dnd5e.originatingMessage", card.id);
    foundry.utils.setProperty(data, `flags.${MODULE_ID}.${REMINDER_FLAG}`,
      { ...reminderRecord({ sources, net, mode, answeredAt: Date.now() }), ...statContext(attacker.uuid) });
    const { rollMode: pickedRollMode, ...picked } = picks;
    await activity.rollAttack({
      ammunition: picked.ammunition ?? config.ammunition,
      attackMode: picked.attackMode ?? config.attackMode,
      mastery: picked.mastery ?? config.mastery,
      ...rollConfigFor(mode, bonus)
    }, { configure: false }, { data, ...(pickedRollMode ? { rollMode: pickedRollMode } : {}) });
  };
  let popup = null;
  const press = mode => {
    const el = popup?.element;
    const bonus = el?.querySelector('input[name="bf-reminder-bonus"]')?.value ?? "";
    const picks = {};
    for ( const c of choices ) {
      const v = el?.querySelector(`select[name="${selectName(c.key)}"]`)?.value;
      if ( v !== undefined ) picks[c.key] = v;
    }
    void reissue(mode, bonus, picks).catch(err => console.error(`${TITLE} | Reminded roll failed.`, err));
  };
  const names = [...new Set([...game.user.targets].map(t => t.document?.name ?? t.actor?.name).filter(Boolean))];
  // The usage card keys the popup (the popper discipline): one gate per card, fronted on a
  // second press of the same button. Closing the window rolls nothing — the card's Attack
  // button is still there. The NET is the default: the highlighted button is the outcome the
  // solver worked out, and Enter presses it — still a press (R-A; user ruling 2026-09-01).
  popup = await openMomentPopup(card, "reminder", attacker, {
    title: `Before you roll — ${item?.name ?? "attack"}`, icon: "fa-solid fa-scale-balanced", width: 460,
    content: bfCard({
      img: item?.img ?? null, eyebrow: "Before you roll",
      tone: TONE_OF[net],
      title: `${modeTitle(net)} on this attack`,
      subtitle: `${attacker.name} — ${item?.name ?? "attack"}${names.length ? ` · against ${names.join(", ")}` : ""}`,
      lines
    }) + choices.map(c => choiceRowHTML(c, selectName(c.key))).join("") + situationalBonusHTML("bf-reminder-bonus"),
    buttons: modeButtons(press, net),
    gate: false
  });
}

/* --- the card line -------------------------------------------------------------------------- */

// The re-issued attack card SAYS it was reminded: what was on the table, what it netted to, what
// was pressed — so a roll that went out with Advantage is explained where everyone looks (R5),
// and the stats plane can read honour off the flag. Stateless, like every render hook here.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const r = message.getFlag(MODULE_ID, REMINDER_FLAG);
  if ( !r?.sources?.length ) return;
  const line = document.createElement("div");
  const what = r.sources.map(s => s.label + (s.bend ? ` (${modeTitle(s.bend)})` : "")).join(" · ");
  line.innerHTML = bfCard({
    eyebrow: "Before the roll", tone: r.honoured ? "good" : "neutral",
    title: `Reminded — net ${modeTitle(r.net)}, rolled ${rolledWith(r.mode)}${r.honoured ? "" : " (against the net)"}`,
    subtitle: what
  });
  html.querySelector(".message-content")?.appendChild(line);
});
