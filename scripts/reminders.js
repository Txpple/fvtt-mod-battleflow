/**
 * Battle Flow — The reminder gate: what bends this attack roll, and what it nets to — BEFORE the dice.
 * Split from mastery.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, statContext } from "./core.js";
import { conditionEntries, reminderEntries } from "./settings.js";
import { chipSpentOnRecord, grantingActor } from "./shared.js";
import { bfCard, reminderFieldsetHTML } from "./decide/present.js";
import { CHIP_FLAG, chipIsDead, chipOwnedBy, rollModeOf } from "./decide/chips.js";
import { CONDITION_BENDS, MASTERY_RULES, RANGE_RULES } from "./decide/registry.js";
import { feetOf, nearestFeet, tokenOfActor } from "./geometry.js";
import { REMINDER_FLAG, conditionSources, modeTitle, netMode, proneSources, rangeSources,
  reminderRecord, reminderSource, reminderView, rolledWith } from "./decide/reminders.js";

/* ---------------------------------------------------------------------------------------------
 * THE GATE (HANDOFF Stage 2 + 3, user rulings 2026-09-01: "I don't want a rescue, I want
 * proactivity"; "if you have multiple sources of adv/disadv contending, it always nets to a
 * regular attack") — INSIDE THE SYSTEM'S OWN DIALOG (user ruling 2026-09-02: "can't the gate
 * look more like the native UI?" — it IS the native UI now).
 *
 * When something this module can READ bends an attack roll — the attacker's own Vexed chip on
 * a target, a Sapped chip on the attacker, Prone on either side (with the 5-foot geometry), a
 * row of the condition table, or a ranged attack's own range — dnd5e's Attack Roll dialog opens
 * as it always does, and Battle Flow adds ONE fieldset to it, beside the dialog's own
 * CONFIGURATION: one header line — the count of modifiers and the net as a coloured tag — then a
 * box per source with its bend as the same tag and its rule quoted verbatim (no net block;
 * user, 2026-09-02). The dialog's DEFAULT BUTTON is the net — the
 * highlighted button is the outcome the solver worked out — and the human presses one of the
 * dialog's own three. The roll goes out natively: the card link, the crit, the attack mode, the
 * ammunition, the mastery, the roll mode and the situational bonus are all the system's,
 * untouched. Nothing here sets a mode (R-A); nothing here re-issues a roll (the 2026-09-01
 * re-issue and its three review findings — the orphaned card, the pinned choices, the forwarded
 * event — are gone with it).
 *
 * ⚠ THE SECTION FOLLOWS THE DIALOG (user, 2026-09-02: "refresh on change of the combo box").
 * The dialog re-renders on every change to its own dropdowns and the render hook fires each
 * time, so the sources are re-judged from the form as it stands — a dagger switched to Thrown
 * grows its range box, switched back it loses it — and the highlighted default moves with the
 * net. A re-target on the canvas re-judges too, the way the dialog's target list already does.
 *
 * ⚠ THE DIALOG IS FORCED OPEN when a reminder applies. dnd5e reads the fast-forward keys AFTER
 * the pre-roll hooks (buildConfigure: preRoll hooks, then applyKeybindings, which sets
 * `dialog.configure ??=` — so a `true` written here survives it), and a shift-clicked swing at
 * a Vexed target still meets the reminder. That is the whole point of a gate.
 *
 * WHERE IT RUNS: on the roller's client — the pre-roll hook fires where the dice are rolled —
 * so it needs no elect and works with no GM connected. A GM rolling a Sapped goblin meets it
 * exactly as a player rolling a Vexed target does.
 *
 * WHAT IT NEVER TOUCHES: a roll whose caller suppressed the dialog (`configure: false`) — the
 * resolver's own rolls, the volley's rays, the riposte inside a fold, a macro, the suites. No
 * dialog, no gate.
 *
 * The pre-roll hook is TEMPLATED (dnd5e.preRoll<Name>V2) — pinned in check-hook-dispatch beside
 * its damage twin, and measured live (tools/probe-expiry.mjs, hookSurfaces). The record of what
 * was pressed rides the generic `dnd5e.postRollConfiguration`, which fires once per roll after
 * the dialog closes with the finalized rolls in hand; the section itself rides the core render
 * hook polish.js already rides for the same dialog.
 * ------------------------------------------------------------------------------------------- */

/** The dialogs standing with a gate in them — re-judged on a re-target (the polish.js idiom: the APP, not the element). */
const openGates = new Set();

Hooks.on("dnd5e.preRollAttackV2", (config, dialog, message) => {
  try {
    const activity = config.subject;
    if ( activity?.type !== "attack" ) return;
    if ( dialog?.configure === false ) return;       // no dialog, no gate
    const attacker = activity.item?.actor;
    if ( !(attacker instanceof Actor) ) return;
    if ( !reminderEntries().length ) return;          // the list is the switch
    // ONE judgement, re-runnable from the dialog's own form: the sources, the net, the view.
    const judge = attackMode => ({ ...judgeRoll(attacker, { activity, attackMode }), attackMode: attackMode ?? null });
    const first = judge(config.attackMode);
    // The dialog carries the judgement whether or not it found anything — one object shared
    // with the config, so the record reads what was LAST shown after any re-judgement, and a
    // dialog that opened bare can still grow a box when its dropdown turns a dagger into a
    // thrown one. Only a judgement WITH sources forces the dialog open and sets its default.
    const gate = { ...first, attackerUuid: attacker.uuid, judge };
    dialog.options ??= {};
    dialog.options.bfReminder = gate;
    config.bfReminder = gate;
    if ( !first.sources.length ) return;
    dialog.configure = true;
    dialog.options.defaultButton = first.net;
  } catch(err) {
    console.error(`${TITLE} | Reminder gate failed — rolling natively.`, err);
  }
});

/**
 * Draw — or redraw — the section in a rendered dialog from the form as it stands, and move the
 * dialog's default button to the net. Idempotent: a re-render that changed nothing redraws the
 * same section; a judgement that yields no source removes it and defaults to Normal.
 */
function drawGate(app, { force = false } = {}) {
  const gate = app.options?.bfReminder;
  const element = app.element;
  if ( !gate?.judge || !element ) return;
  let attackMode = gate.attackMode;
  try {
    const form = app.form ?? element.querySelector("form");
    const data = form ? new foundry.applications.ux.FormDataExtended(form) : null;
    if ( data?.has("attackMode") ) attackMode = data.get("attackMode");
  } catch { /* the form is the dialog's; a missing read keeps the last judgement */ }
  const existing = element.querySelector("[data-bf-reminder]");
  const unchanged = (attackMode === gate.attackMode) && (!!existing === (gate.sources?.length > 0));
  if ( unchanged && !force ) return;
  const next = gate.judge(attackMode);
  Object.assign(gate, next);
  // A section the human unfolded stays unfolded through the dialog's own re-renders.
  const open = !!existing?.querySelector("details[data-bf-reminder-details]")?.open;
  existing?.remove();
  if ( next.sources.length ) {
    const host = document.createElement("div");
    host.innerHTML = reminderFieldsetHTML(next.view, { open });
    const fieldset = host.firstElementChild;
    const configuration = element.querySelector('[data-application-part="configuration"]');
    const buttons = element.querySelector('[data-application-part="buttons"]');
    if ( configuration ) configuration.insertAdjacentElement("afterend", fieldset);
    else if ( buttons ) buttons.insertAdjacentElement("beforebegin", fieldset);
    else element.querySelector("form")?.appendChild(fieldset);
  }
  // The highlighted default follows the net — the button the dialog itself marks and focuses.
  for ( const button of element.querySelectorAll('[data-application-part="buttons"] button[data-action]') ) {
    const isDefault = button.dataset.action === next.net;
    button.toggleAttribute("autofocus", isDefault);
    if ( isDefault ) { try { button.focus(); } catch { /* not focusable yet */ } }
  }
}

// The section: on every render of a dialog carrying the gate — the first, and each re-render
// the dialog's own dropdowns cause (only its formula part is replaced; the section is a sibling
// inserted AFTER the CONFIGURATION fieldset, the same markup, so the dialog's own styling
// dresses it).
Hooks.on("renderRollConfigurationDialog", (app, element) => {
  try {
    if ( !app.options?.bfReminder ) return;
    openGates.add(app);
    drawGate(app);
  } catch(err) {
    console.error(`${TITLE} | Reminder section failed to draw.`, err);
  }
});

// A re-target while the dialog stands fires no dialog render; the judgement follows the canvas.
Hooks.on("targetToken", () => {
  for ( const app of openGates ) {
    if ( app.rendered && app.element ) { try { drawGate(app, { force: true }); } catch(err) { console.error(`${TITLE} | Reminder section failed to redraw.`, err); } }
    else openGates.delete(app);
  }
});

// The record: what was shown, what it netted to, what the human pressed — stamped on the
// attack message's data after the dialog closes with rolls in hand (a closed dialog hands back
// no rolls, and no roll is no record; a judgement that emptied out is no record either). The
// spend reads it off the message at creation.
Hooks.on("dnd5e.postRollConfiguration", (rolls, config, dialog, message) => {
  try {
    const gate = config?.bfReminder;
    if ( !gate?.sources?.length || !rolls?.length || (config.subject?.type !== "attack") ) return;
    const mode = rollModeOf(rolls[0]?.options?.advantageMode);
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.${REMINDER_FLAG}`, {
      ...reminderRecord({ sources: gate.sources, net: gate.net, mode, answeredAt: Date.now() }),
      ...statContext(gate.attackerUuid)
    });
  } catch(err) {
    console.error(`${TITLE} | Reminder record failed.`, err);
  }
});

/* --- reading the table ---------------------------------------------------------------------- */


/**
 * The range facts of THIS attack, as the dialog stands: is it a ranged attack roll (the
 * activity's attack type, or a weapon thrown — the attack mode is the dialog's dropdown), and
 * its normal and long range in feet. A weapon's range is the item's (normal/long) unless the
 * activity overrides it; a spell's is the activity's single range.
 */
function rangeFactsFor(activity, attackMode) {
  const item = activity?.item;
  const thrown = String(attackMode ?? "").startsWith("thrown");
  const ranged = thrown || (activity?.attack?.type?.value === "ranged");
  if ( !ranged ) return { ranged: false };
  let value = null, long = null, units = null;
  if ( activity.range?.override || (item?.type !== "weapon") ) {
    value = activity.range?.value; units = activity.range?.units;
  } else {
    value = item.system.range?.value; long = item.system.range?.long; units = item.system.range?.units;
  }
  return { ranged: true, normalFeet: feetOf(value, units), longFeet: feetOf(long, units) };
}

/**
 * The enemies within 5 feet of the attacker's token: alive, not Incapacitated, on the other
 * side of the table (a friendly attacker's enemies are hostile tokens and vice versa; a neutral
 * or secret attacker has none the module can name). "Can see you" is the caveat the box carries.
 */
function closeEnemiesOf(attackerToken) {
  if ( !attackerToken ) return [];
  const mine = attackerToken.document?.disposition;
  const enemy = (mine === 1) ? -1 : (mine === -1) ? 1 : null;
  if ( enemy === null ) return [];
  const out = [];
  for ( const other of (canvas.tokens?.placeables ?? []) ) {
    if ( (other === attackerToken) || (other.document?.disposition !== enemy) ) continue;
    const actor = other.actor;
    if ( !actor || ((actor.system?.attributes?.hp?.value ?? 0) <= 0) || actor.statuses?.has?.("incapacitated") ) continue;
    const d = nearestFeet(attackerToken, other);
    if ( (d !== null) && (d <= 5) ) out.push(other.document?.name ?? actor.name);
  }
  return [...new Set(out)];
}

/**
 * Every source this gate can read for the roll about to happen, in the order the table reads
 * them: the attacker's own state first, then each target's. Names are the TOKEN's where a token
 * is what was targeted — that is what the table calls it. A chip is live when the platform has
 * not marked it (decide/chips.js) AND no spend is already on record for it (shared.js) — a chip
 * a no-GM table could not delete is still spent — AND an earlier roll of the same volley has
 * not already spent it (`spent`, the ids a volley's earlier rays used up; the chip is still on
 * the sheet while the caster aims). `activity` and `attackMode` are the roll's, as the dialog
 * stands — the range kind reads them. `targets` are the tokens this roll is at; the user's own
 * targets when not given. Each chip source carries its `effectId`, so a volley can carry the
 * spend forward ray by ray; `spendNote` is appended to a chip's label ("— spent by this ray").
 */
function sourcesFor(attacker, enabled, { activity = null, attackMode = null, targets = null, spent = null, spendNote = "" } = {}) {
  const out = [];
  const attackerName = attacker.name;
  const live = e => !chipIsDead(e.duration ?? {}) && !chipSpentOnRecord(e) && !spent?.has(e.id);
  const conditions = enabled.has("condition") ? conditionEntries().map(e => e.kind) : [];
  const conditionFacts = { enabled: conditions, table: CONDITION_BENDS };
  const attackerToken = tokenOfActor(attacker);
  const range = enabled.has("range") ? rangeFactsFor(activity, attackMode) : { ranged: false };

  // The attacker's own state.
  if ( enabled.has("sap") ) {
    for ( const e of attacker.effects ) {
      if ( (e.getFlag(MODULE_ID, CHIP_FLAG) !== "sap") || !live(e) ) continue;
      const by = grantingActor(e)?.name ?? null;
      out.push(Object.assign(reminderSource("sap", "disadvantage",
        `${attackerName} — ${e.name}${by ? ` by ${by}` : ""}${spendNote}`, MASTERY_RULES.sap), { effectId: e.id }));
    }
  }
  if ( enabled.has("prone") ) {
    out.push(...proneSources({ attackerProne: attacker.statuses?.has?.("prone"), attackerName }));
  }
  if ( conditions.length ) {
    out.push(...conditionSources({ ...conditionFacts, attackerStatuses: attacker.statuses ?? [], attackerName }));
  }
  if ( range.ranged ) {
    out.push(...rangeSources({ ranged: true, closeEnemies: closeEnemiesOf(attackerToken), attackerName, rules: RANGE_RULES }));
  }

  // Each target.
  for ( const token of (targets ?? game.user.targets) ) {
    const target = token.actor;
    if ( !target || (target.uuid === attacker.uuid) ) continue;
    const targetName = token.document?.name ?? target.name;
    const distanceFeet = attackerToken ? nearestFeet(attackerToken, token) : null;
    if ( enabled.has("vex") ) {
      for ( const e of target.effects ) {
        if ( (e.getFlag(MODULE_ID, CHIP_FLAG) !== "vex") || !chipOwnedBy(e.origin, attacker.uuid) || !live(e) ) continue;
        out.push(Object.assign(reminderSource("vex", "advantage", `${attackerName} Vexed ${targetName}${spendNote}`,
          MASTERY_RULES.vex), { effectId: e.id }));
      }
    }
    if ( enabled.has("prone") && target.statuses?.has?.("prone") ) {
      out.push(...proneSources({ targetProne: true, distanceFeet, targetName }));
    }
    if ( conditions.length ) {
      out.push(...conditionSources({ ...conditionFacts, targetStatuses: target.statuses ?? [], targetName }));
    }
    if ( range.ranged ) {
      out.push(...rangeSources({ ranged: true, distanceFeet, normalFeet: range.normalFeet, longFeet: range.longFeet,
        targetName, rules: RANGE_RULES }));
    }
  }
  return out;
}

/**
 * THE JUDGE, for any surface that meets a roll before its dice: the sources this attacker's
 * roll bends by, the net, and the view the section draws. The dialog's gate calls it on every
 * render; a volley's aim popup calls it once per ray, in ray order, handing forward the chips
 * earlier rays spend (`spent`) — the Sap that ray 1 uses up is not offered to ray 2. Null when
 * the Reminder Sources list is empty: the list is the switch.
 * @param {Actor} attacker
 * @param {{activity?: object|null, attackMode?: string|null, targets?: Token[]|null,
 *          spent?: Set<string>|null, spendNote?: string}} [facts]
 * @returns {{sources: object[], net: "advantage"|"disadvantage"|"normal", view: object, spends: string[]}|null}
 */
export function judgeRoll(attacker, { activity = null, attackMode = null, targets = null, spent = null, spendNote = "" } = {}) {
  const enabled = new Set(reminderEntries().map(e => e.kind));
  if ( !enabled.size ) return null;
  const sources = sourcesFor(attacker, enabled, { activity, attackMode, targets, spent, spendNote });
  const net = netMode(sources);
  return { sources, net, view: reminderView(sources, net), spends: sources.map(s => s.effectId).filter(Boolean) };
}

/* --- the card line -------------------------------------------------------------------------- */

// The attack card SAYS it was reminded: what was on the table, what it netted to, what was
// pressed — so a roll that went out with Advantage is explained where everyone looks (R5), and
// the stats plane can read honour off the flag. Stateless, like every render hook here.
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
