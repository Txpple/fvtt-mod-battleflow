/**
 * Battle Flow — The reminder gate: what bends this attack roll, and what it nets to — BEFORE the dice.
 * Split from mastery.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, statContext } from "./core.js";
import { conditionEntries, reminderEntries } from "./settings.js";
import { rollConfigFor } from "./shared.js";
import { bfCard, modeButtons, ruleLine, situationalBonusHTML } from "./decide/present.js";
import { openMomentPopup } from "./ui.js";
import { CHIP_FLAG, chipIsDead, chipOwnedBy } from "./decide/chips.js";
import { MASTERY_RULES } from "./decide/registry.js";
import { tokenSamplePoints } from "./decide/geometry.js";
import { REMINDER_FLAG, conditionSources, modeTitle, netMode, proneSources, reminderRecord,
  reminderSource, resolutionLine } from "./decide/reminders.js";

/* ---------------------------------------------------------------------------------------------
 * THE GATE (HANDOFF Stage 2 + 3, user rulings 2026-09-01: "I don't want a rescue, I want
 * proactivity"; "if you have multiple sources of adv/disadv contending, it always nets to a
 * regular attack").
 *
 * When something this module can READ bends an attack roll — the attacker's own Vexed chip on
 * a target, a Sapped chip on the attacker, Prone on either side (with the 5-foot geometry), or
 * one of the thirteen conditions in the table — the system's roll dialog does not open. Battle
 * Flow's popup does, carrying the dialog's own controls (the concentration precedent: "the
 * POPUP is the configuration surface", user call 2026-08-16): every source, the net, the
 * glossary's own sentence on why, a situational bonus, and Advantage / Normal / Disadvantage.
 * The human presses; the roll is re-issued with the press. Nothing here sets a mode (R-A).
 *
 * WHERE IT RUNS: on the roller's client — the pre-roll hook fires where the dice are rolled —
 * so it needs no elect and works with no GM connected. A GM rolling a Sapped goblin meets it
 * exactly as a player rolling a Vexed target does.
 *
 * WHAT IT NEVER TOUCHES: a roll whose caller suppressed the dialog (`configure: false`) — the
 * resolver's own rolls, the volley's rays, the riposte inside a fold, a macro, the suites, and
 * this file's own re-issue. No dialog, no gate. ⚠ dnd5e evaluates fast-forward keys AFTER this
 * hook (buildConfigure: preRoll hooks, then applyKeybindings), so a shift-clicked roll still
 * reads `configure` undefined here and IS gated — which is the whole point of a gate.
 *
 * The hook is TEMPLATED (dnd5e.preRoll<Name>V2) — pinned in check-hook-dispatch beside its
 * damage twin, and measured live (tools/probe-expiry.mjs, hookSurfaces).
 * ------------------------------------------------------------------------------------------- */

/** The Rules Glossary, "Advantage" (dnd5e.content24 / the premium PHB) — verbatim, law 8. */
const NET_RULE = "A roll can’t be affected by more than one Advantage, and Advantage and Disadvantage on the same roll cancel each other.";

/** The activity uuids this file is re-issuing right now — the hook lets those through. */
const reissuing = new Set();

Hooks.on("dnd5e.preRollAttackV2", (config, dialog, message) => {
  try {
    const activity = config.subject;
    if ( activity?.type !== "attack" ) return;
    if ( reissuing.delete(activity.uuid) ) return;   // our own re-issue — let it roll
    if ( dialog?.configure === false ) return;       // no dialog, no gate
    const attacker = activity.item?.actor;
    if ( !(attacker instanceof Actor) ) return;
    const enabled = new Set(reminderEntries().map(e => e.kind));
    if ( !enabled.size ) return;                      // the list is the switch
    const sources = sourcesFor(attacker, enabled);
    if ( !sources.length ) return;
    void showGate({ activity, attacker, sources, config, message });
    return false;                                     // the veto: the popup is the dialog
  } catch(err) {
    console.error(`${TITLE} | Reminder gate failed — rolling natively.`, err);
  }
});

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
 * The shortest grid distance between two tokens, in scene units — sample every occupied
 * square of each so a Large body counts from its nearest edge, and let the scene's own grid do
 * the measuring. Null when either side cannot be measured.
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
    return Number.isFinite(best) ? Math.round(best * 10) / 10 : null;
  } catch {
    return null;
  }
}

/**
 * Every source this gate can read for the roll about to happen, in the order the table reads
 * them: the attacker's own state first, then each target's. Names are the TOKEN's where a token
 * is what was targeted — that is what the table calls it.
 */
function sourcesFor(attacker, enabled) {
  const out = [];
  const attackerName = attacker.name;
  const live = e => !chipIsDead(e.duration ?? {});
  const conditions = enabled.has("condition") ? conditionEntries().map(e => e.kind) : [];

  // The attacker's own state.
  if ( enabled.has("sap") ) {
    for ( const e of attacker.effects ) {
      if ( (e.getFlag(MODULE_ID, CHIP_FLAG) !== "sap") || !live(e) ) continue;
      const by = (() => { try { return fromUuidSync(e.origin)?.actor?.name ?? null; } catch { return null; } })();
      out.push(reminderSource("sap", "disadvantage",
        `${attackerName} — ${e.name}${by ? ` by ${by}` : ""}`, MASTERY_RULES.sap));
    }
  }
  if ( enabled.has("prone") ) {
    out.push(...proneSources({ attackerProne: attacker.statuses?.has?.("prone"), attackerName }));
  }
  if ( conditions.length ) {
    out.push(...conditionSources({ attackerStatuses: attacker.statuses ?? [], enabled: conditions, attackerName }));
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
      out.push(...conditionSources({ targetStatuses: target.statuses ?? [], enabled: conditions, targetName }));
    }
  }
  return out;
}

/* --- the popup, and the re-issue ------------------------------------------------------------ */

const TONE_OF = { advantage: "good", disadvantage: "pending", normal: "neutral" };

async function showGate({ activity, attacker, sources, config, message }) {
  const net = netMode(sources);
  const item = activity.item;
  const lines = [];
  for ( const s of sources ) {
    const bend = s.bend ? ` — <strong>${modeTitle(s.bend)}</strong>` : "";
    lines.push(`${s.label}${bend}`);
    if ( s.detail ) lines.push(ruleLine(s.detail));
  }
  lines.push(`<strong>Net: ${modeTitle(net)}.</strong> ${resolutionLine(sources, net)}`);
  if ( sources.length > 1 ) lines.push(ruleLine(NET_RULE));

  const reissue = async (mode, bonus) => {
    reissuing.add(activity.uuid);
    try {
      await activity.rollAttack({
        ammunition: config.ammunition, attackMode: config.attackMode, mastery: config.mastery,
        ...rollConfigFor(mode, bonus)
      }, { configure: false }, { data: foundry.utils.mergeObject(message?.data ?? {}, { flags: { [MODULE_ID]: {
        [REMINDER_FLAG]: { ...reminderRecord({ sources, net, mode, answeredAt: Date.now() }), ...statContext(attacker.uuid) }
      } } }, { inplace: false }) });
    } finally {
      reissuing.delete(activity.uuid);
    }
  };
  let dialog = null;
  const press = mode => {
    const bonus = dialog?.element?.querySelector('input[name="bf-reminder-bonus"]')?.value ?? "";
    void reissue(mode, bonus).catch(err => console.error(`${TITLE} | Reminded roll failed.`, err));
  };
  const names = [...new Set([...game.user.targets].map(t => t.document?.name ?? t.actor?.name).filter(Boolean))];
  const options = {
    title: `Before you roll — ${item?.name ?? "attack"}`, icon: "fa-solid fa-scale-balanced", width: 460,
    content: bfCard({
      img: item?.img ?? null, eyebrow: "Before you roll",
      tone: TONE_OF[net],
      title: `${modeTitle(net)} on this attack`,
      subtitle: `${attacker.name} — ${item?.name ?? "attack"}${names.length ? ` · against ${names.join(", ")}` : ""}`,
      lines
    }) + situationalBonusHTML("bf-reminder-bonus"),
    // The same three controls the concentration ask carries (decide/present.js). No default:
    // nothing is pre-selected; the press is the decision (R-A). Closing the window rolls
    // nothing — the card's Attack button is still there.
    buttons: modeButtons(press)
  };
  // The usage card keys the popup (the popper discipline); an attack rolled without one gets a
  // bare dialog of the same shape.
  const card = game.messages.get(message?.data?.flags?.dnd5e?.originatingMessage ?? "") ?? null;
  dialog = card
    ? await openMomentPopup(card, "reminder", attacker, { ...options, gate: false })
    : await new foundry.applications.api.DialogV2({
      window: { title: options.title, icon: options.icon }, position: { width: options.width },
      content: options.content, buttons: options.buttons, rejectClose: false
    }).render({ force: true });
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
    title: `Reminded — net ${modeTitle(r.net)}, rolled ${modeTitle(r.mode)}${r.honoured ? "" : " (against the net)"}`,
    subtitle: what
  });
  html.querySelector(".message-content")?.appendChild(line);
});
