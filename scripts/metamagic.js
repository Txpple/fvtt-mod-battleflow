/**
 * Battle Flow — Metamagic: the Sorcerer's options as a group in the spell's casting window, the
 * Sorcery Points spent by hand on the spell's card (DESIGN §6 *Metamagic*, user rulings
 * 2026-09-09; PLAN *THE METAMAGIC PASS*).
 *
 * The MOMENT is the cast. The system's own ActivityUsageDialog gets one fieldset on its render
 * hook (the emanation damage-type radios' idiom): a row per listed option the sheet grants — a
 * tick, the feat's name, the cost as the tag, the rule folded under — and the pool line above
 * them. The pick waits in memory on the casting client, keyed by the activity, until the cast's
 * card is born: `preCreateChatMessage` stamps it on the card (a birth flag — the saves machine's
 * demand stamp reads it on the same hook cycle, so Careful is on the card before the demand
 * exists), and `postUseActivity` spends the points and writes the `poolSpend` record the flash,
 * the card line and the ledger all read (`poolSpendsOn`, shared.js — the uniform spend).
 *
 * What this file reads: the metamagic feats on the sheet (the pack's `type.subtype`), Font of
 * Magic as the option's own consumption target (`poolOf` resolves the pack's compendium uuid
 * once the owned copy carries its source stamp — measured 2026-09-09), and the SPELL's shape for
 * the fit. What it never judges: sight, willingness, the turn (DESIGN §8).
 *
 * Careful's protected set and Heightened's mark (Stage 2) ride the same birth flag, derived where
 * the save's reach is known (saves/demand.js). The later moments: Empowered is the fold on the
 * damage dice at the end of this file (Stage 4); Seeking is a d20 fold KIND in d20-folds.js — the
 * machine that already owns the reroll, the verdict and the withheld save.
 */
import { MODULE_ID, TITLE, S, setting, statContext, queueFlagWrite, isActiveGM, whisperNoGM, canAnswerFor } from "./core.js";
import { lower, resolveUuid } from "./lookup.js";
import { metamagicEntries, listedNames } from "./settings.js";
import { poolOf, spendPoolUses, isPartyMember } from "./shared.js";
import { feetOf, tokenOfActor, tokensInTemplates } from "./geometry.js";
import { bfCard, foldedRuleHTML, esc, holdBarHTML, popupKey, ruleLine, spendPhrase } from "./decide/present.js";
import { METAMAGIC, TRANSMUTED_TYPES, TWINNED_EXCEPTIONS, tableIndex } from "./decide/registry.js";
import { METAMAGIC_FLAG, METAMAGIC_ASK_FLAG, askDefaults, metamagicMenu, metamagicPick, metamagicRuleText, metamagicCardLine, distantRange, scalesTargetsFrom, empoweredPlan, empoweredOutcome, carefulProtects, heightenedMark } from "./decide/metamagic.js";
import { openMomentPopup, momentButton, armAskTimer, disarmAskTimer, livePopups, scheduleBarSync, dramaticVerdictPause, registerResumable } from "./ui.js";
import { raiseHold, releaseHold, isHeld } from "./holds.js";
import { saveTargetEntry } from "./decide/demand.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";

const INDEX = tableIndex(METAMAGIC);
/** The name the record shows for Font of Magic's uses — what the table calls them. */
const POOL_NAME = "Sorcery Points";

/* ---------------------------------------------------------------------------------------------
 * The sheet: the options the caster knows, and the pool they draw on
 * ------------------------------------------------------------------------------------------- */

/** The metamagic feats on the sheet that the table knows and the list admits, by feat name. */
function knownOptions(actor) {
  const listed = listedNames(metamagicEntries());
  const out = new Map();
  for ( const item of (actor?.items ?? []) ) {
    if ( (item.type !== "feat") || (lower(item.system?.type?.subtype) !== "metamagic") ) continue;
    const feature = INDEX.keyNamed(item.name);
    if ( !feature || !listed.has(lower(feature)) ) continue;
    out.set(feature, item);
  }
  return out;
}

/** The option's own cost: its activity's `itemUses` consumption value, read live (N1). */
function costOf(item) {
  const activity = item?.system?.activities?.contents?.[0] ?? null;
  const target = activity?.consumption?.targets?.find(t => t.type === "itemUses") ?? null;
  const n = Number(target?.value);
  return Number.isFinite(n) && (n > 0) ? n : null;
}

/** The pool the option consumes — Font of Magic on a 2024 sheet — resolved through the option's own target. */
function poolFor(actor, item) {
  const activity = item?.system?.activities?.contents?.[0] ?? null;
  return activity ? poolOf(actor, activity) : null;
}

/**
 * Who an option can name IN THE WINDOW: the creatures the caster has selected, and nobody else
 * (user, 2026-09-09, third look: a scene-wide list "on a screen with many actors is too much").
 * A cast that selects nobody — the area comes later — is asked at the area instead (the ask flag,
 * below). Plain rows for the decision layer, which picks the defaults.
 */
function candidatesFor(actor) {
  const casterTok = tokenOfActor(actor) ?? null;
  const casterDisposition = casterTok?.document?.disposition ?? actor.prototypeToken?.disposition ?? CONST.TOKEN_DISPOSITIONS.FRIENDLY;
  const selected = [...(game.user?.targets ?? [])]
    .map(t => ({ uuid: t.actor?.uuid ?? null, name: t.document?.name ?? t.name, disposition: t.document?.disposition ?? null }))
    .filter(t => t.uuid);
  return { casterDisposition, casterUuid: actor.uuid, targets: selected };
}

/** The facts of the spell being cast, as decide/metamagic.js reads them. */
function spellFactsOf(activity) {
  const item = activity?.item;
  const sys = item?.system ?? {};
  const range = activity?.range?.override ? activity.range : sys.range;
  const units = String(range?.units ?? "");
  const rangeFeet = (units === "touch" || units === "self" || !units) ? null : feetOf(range?.value, units);
  const duration = activity?.duration?.override ? activity.duration : sys.duration;
  const MIN = { round: 0.1, minute: 1, hour: 60, day: 1440, month: 43200, year: 525600, perm: Infinity };
  const minutes = (Number(duration?.value) || 0) * (MIN[String(duration?.units ?? "")] ?? 0);
  const activation = activity?.activation?.override ? activity.activation : sys.activation;
  const parts = activity?.damage?.parts ?? [];
  const damageTypes = [...new Set(parts.flatMap(p => [...(p.types ?? [])].map(lower)))];
  return {
    save: (activity?.type === "save") || !!activity?.save?.ability?.size,
    rangeFeet, touch: units === "touch", minutes,
    action: String(activation?.type ?? "") === "action",
    damageTypes, damageRoll: parts.length > 0,
    spellAttack: activity?.type === "attack",
    // The SOURCE count, not the prepared one: `@item.level - 1` is what says the spell gains a
    // target at a higher level (the prepared value is a number — measured, Stage 0).
    scalesTargets: !activity?.target?.template?.type && scalesTargetsFrom(item?.system?._source?.target?.affects?.count ?? null, { name: item?.name ?? null, exceptions: TWINNED_EXCEPTIONS })
  };
}

/* ---------------------------------------------------------------------------------------------
 * The casting window: one fieldset, the pick held until the cast lands
 * ------------------------------------------------------------------------------------------- */

/** activity uuid → the pick made in the dialog (`{ key, feature, cost, poolId, rangeFeet }`). */
const pending = new Map();

Hooks.on("renderActivityUsageDialog", (app, element) => {
  try {
    const activity = app?.activity ?? app?.options?.activity ?? null;
    const actor = activity?.actor;
    if ( !activity || (activity.item?.type !== "spell") || !actor?.isOwner ) return;
    if ( element.querySelector("[data-bf-metamagic-field]") ) return;
    const known = knownOptions(actor);
    if ( !known.size ) return;
    const first = [...known.values()].map(i => poolFor(actor, i)).find(Boolean) ?? null;
    const points = Math.max(0, Number(first?.system?.uses?.value ?? 0));
    const max = Number(first?.system?.uses?.max ?? 0);
    const costs = Object.fromEntries([...known].map(([feature, item]) => [feature, costOf(item)]));
    const facts = spellFactsOf(activity);
    const menu = metamagicMenu({ table: METAMAGIC, listed: known.keys(), known: known.keys(), facts, points, costs, transmutedTypes: TRANSMUTED_TYPES });
    if ( !menu.length ) return;
    const current = pending.get(activity.uuid)?.key ?? null;
    const currentType = pending.get(activity.uuid)?.type ?? null;
    // CAREFUL'S TICKS ARE IN THE WINDOW, BEFORE THE CAST GOES OUT (user ruling 2026-09-09, second
    // look: "the ticks need to be not on the card, but the popup … picking before casting is
    // executed"; "non-hostile actors (neutral and allies) as default picks"). The candidates are
    // the caster's selected targets when there are any, else every non-hostile creature on the
    // scene the spell can reach (nearest first, the caster among them), pre-ticked up to the cap
    // by carefulProtects' own default. The pick rides the record as CHOSEN, so the demand honours
    // it against whatever the area finally contains.
    const cap = Math.max(1, Number(actor.system?.abilities?.cha?.mod) || 1);
    const selected = candidatesFor(actor);
    // A TEMPLATE SPELL LISTS NOBODY IN THE WINDOW (user, 2026-09-10, Fireball with Thomas targeted:
    // "it shouldn't have him in the check box. just assume a template and don't put targeted creatures
    // in there"). Whoever is targeted is not who the area will hold; the pick waits for the placed
    // template and is asked there, of everything inside it - the carrier road, §18's.
    if ( activity?.target?.template?.type ) selected.targets = [];
    const protect = { cap, ...selected, chosen: pending.get(activity.uuid)?.protected?.map(p => p.uuid) ?? null };
    // Heightened's one target the same way, a radio over the selected creatures.
    const mark = { ...selected, chosen: pending.get(activity.uuid)?.target?.uuid ?? null };
    const fs = document.createElement("fieldset");
    fs.dataset.bfMetamagicField = "";
    fs.innerHTML = `<legend>Battle Flow — Metamagic</legend>
      <div data-bf-metamagic-pool style="display:flex;justify-content:space-between;font-size:var(--font-size-12,12px);opacity:0.85;margin:0 0 0.25rem;">
        <span>${esc(actor.name)}</span><span><strong>${POOL_NAME}: ${points} of ${max}</strong>${first ? "" : " — no pool found"}</span></div>
      ${menu.map(row => rowHTML(row, known.get(row.feature), current, { facts, currentType, protect, mark })).join("")}
      ${points === 0 ? `<p class="hint" style="margin:0.25rem 0 0;">No ${POOL_NAME} — the rows stay so the sheet is not the only place that says so.</p>` : ""}`;
    const boxes = fs.querySelectorAll('input[name="bf-metamagic"]');
    const sync = () => {
      const picked = [...boxes].find(b => b.checked)?.value ?? null;
      for ( const b of boxes ) {
        const row = b.closest("[data-bf-metamagic-row]");
        const own = b.value === picked;
        if ( !picked || own ) b.disabled = row?.dataset.bfOff === "1";
        else b.disabled = true;   // one option per cast: a tick greys the rest
        if ( row ) row.style.opacity = (b.disabled && !own) ? "0.55" : "1";
      }
      // HEIGHTENED'S RADIO IS INERT UNTIL HEIGHTENED IS TICKED (user, 2026-09-10: "targets of heightened
      // should be greyed out if the checkbox is not checked"). A live radio under an unticked option
      // reads as a choice already made; it greys with its row and wakes with the tick.
      const heightenedOn = picked === "heightened";
      for ( const r of fs.querySelectorAll('[data-bf-metamagic-row="heightened"] input[name="bf-metamagic-mark"]') ) r.disabled = !heightenedOn;
      const markSub = fs.querySelector('[data-bf-metamagic-row="heightened"] [data-bf-metamagic-sub="mark"]');
      if ( markSub ) markSub.style.opacity = heightenedOn ? "1" : "0.45";
      const row = menu.find(r => r.key === picked);
      const pick = metamagicPick({ menu, chosen: picked });
      if ( pick ) {
        const item = known.get(pick.feature);
        const typeBox = fs.querySelector(`[data-bf-metamagic-row="transmuted"] input[name="bf-metamagic-type"]:checked`);
        const protectBoxes = [...fs.querySelectorAll(`[data-bf-metamagic-row="careful"] input[name="bf-metamagic-protect"]`)];
        const protectOn = protectBoxes.filter(b => b.checked);
        for ( const b of protectBoxes ) if ( !b.checked ) b.disabled = protectOn.length >= cap;
        const markBox = fs.querySelector(`[data-bf-metamagic-row="heightened"] input[name="bf-metamagic-mark"]:checked`);
        pending.set(activity.uuid, { key: pick.key, feature: pick.feature, cost: pick.cost, itemUuid: item?.uuid ?? null, actorUuid: actor.uuid, at: Date.now(),
          spellUuid: activity.item?.uuid ?? null, activityUuid: activity.uuid, spellName: activity.item?.name ?? null,
          // The option's rule rides the record where a later gate quotes it (Extended's concentration source).
          ...(pick.key === 'extended' ? { rule: metamagicRuleText(item?.system?.description?.value ?? '') } : {}),
          poolId: poolFor(actor, item)?.id ?? null,
          // Transmuted's new type: the radio under its row (the first other listed type until picked).
          ...(pick.key === "transmuted" ? { from: facts.damageTypes.filter(t => TRANSMUTED_TYPES.includes(t)), type: typeBox?.value ?? TRANSMUTED_TYPES.find(t => !facts.damageTypes.includes(t)) ?? null } : {}),
          ...(pick.key === "distant" ? { rangeFeet: distantRange(facts) } : {}),
          // Careful's cap is the Charisma modifier, minimum one (the option's own words); the
          // protected list itself is derived where the save's reach is known (saves/demand.js).
          ...(pick.key === "careful" ? { cap, ...(protectBoxes.length ? { chosen: true, protected: protectOn.map(b => ({ uuid: b.value, name: b.dataset.name ?? b.value })) } : {}) } : {}),
          // Heightened's rule rides the demand for the save gate's fold (law 8: the feat's own text),
          // and the target the window marked rides as CHOSEN.
          ...(pick.key === "heightened" ? { rule: metamagicRuleText(item?.system?.description?.value ?? ""),
            ...(markBox ? { chosen: true, target: { uuid: markBox.value, name: markBox.dataset.name ?? markBox.value } } : {}) } : {}) });
      } else pending.delete(activity.uuid);
    };
    for ( const b of boxes ) b.addEventListener("change", sync);
    for ( const r of fs.querySelectorAll('input[name="bf-metamagic-type"], input[name="bf-metamagic-protect"], input[name="bf-metamagic-mark"]') ) r.addEventListener("change", sync);
    sync();
    const footer = element.querySelector("footer, .form-footer");
    if ( footer ) footer.before(fs); else (element.querySelector("form") ?? element).appendChild(fs);
  } catch(err) { console.warn(`${TITLE} | Could not add the metamagic fieldset.`, err); }
});

// ⚠ A PICK OUTLIVES ITS DIALOG ONLY UNTIL A CARD IS BORN. A tick made and the window cancelled, or a
// cast whose template is never placed (measured 2026-09-09: the pick landed on the NEXT Fireball,
// spent a point for an option nobody ticked), must not wait in memory for the next cast of the
// same spell. The dialog's close hook sweeps a pick no card has claimed, after the card's own
// creation has had its moment; and the stamp refuses a pick older than the window a cast can take.
const PICK_TTL_MS = 5 * 60 * 1000;
Hooks.on("closeActivityUsageDialog", app => {
  try {
    const uuid = (app?.activity ?? app?.options?.activity)?.uuid ?? null;
    if ( !uuid || !pending.has(uuid) ) return;
    setTimeout(() => { const p = pending.get(uuid); if ( p && !p.born ) pending.delete(uuid); }, 3000);
  } catch { /* the sweep is a courtesy */ }
});

/** One row: the tick, the name, the tag, the rule folded under — nothing above the fold (the offer-row law). */
function rowHTML(row, item, current, { facts = null, currentType = null, protect = null, mark = null } = {}) {
  const off = !row.eligible || !row.affordable;
  const rule = metamagicRuleText(item?.system?.description?.value ?? "");
  // Transmuted's one pick beyond the tick: the new type, a radio per listed type the spell does
  // not already deal (the prototype's row). Not a caveat — a control the option's text demands.
  let sub = "";
  if ( (row.key === "transmuted") && !off ) {
    const has = new Set(facts?.damageTypes ?? []);
    const options = TRANSMUTED_TYPES.filter(t => !has.has(t));
    const picked = currentType ?? options[0] ?? null;
    const cap = s => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
    sub = `<div data-bf-metamagic-sub="type" style="grid-column:2 / -1;display:flex;flex-wrap:wrap;gap:0.3rem 0.75rem;font-size:var(--font-size-12,12px);">
      ${options.map(t => `<label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;"><input type="radio" name="bf-metamagic-type" value="${t}" ${t === picked ? "checked" : ""} style="margin:0;"> ${cap(t)}</label>`).join("")}</div>`;
  }
  if ( (row.key === "careful") && !off && protect?.targets?.length ) {
    const defaults = new Set(carefulProtects({ contained: protect.targets, casterUuid: protect.casterUuid, casterDisposition: protect.casterDisposition, cap: protect.cap, chosen: protect.chosen }).map(p => p.uuid));
    sub = `<div data-bf-metamagic-sub="protect" style="grid-column:2 / -1;display:flex;flex-wrap:wrap;gap:0.3rem 0.75rem;font-size:var(--font-size-12,12px);">
      ${protect.targets.map(t => `<label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;"><input type="checkbox" name="bf-metamagic-protect" value="${esc(t.uuid)}" data-name="${esc(t.name)}" ${defaults.has(t.uuid) ? "checked" : ""} style="margin:0;"> ${esc(t.name)}</label>`).join("")}</div>`;
  }
  if ( (row.key === "heightened") && !off && mark?.targets?.length ) {
    const picked = heightenedMark({ contained: mark.targets, casterUuid: mark.casterUuid, casterDisposition: mark.casterDisposition, chosen: mark.chosen })?.uuid ?? null;
    sub = `<div data-bf-metamagic-sub="mark" style="grid-column:2 / -1;display:flex;flex-wrap:wrap;gap:0.3rem 0.75rem;font-size:var(--font-size-12,12px);">
      ${mark.targets.map(t => `<label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;"><input type="radio" name="bf-metamagic-mark" value="${esc(t.uuid)}" data-name="${esc(t.name)}" ${t.uuid === picked ? "checked" : ""} style="margin:0;"> ${esc(t.name)}</label>`).join("")}</div>`;
  }
  return `<div data-bf-metamagic-row="${esc(row.key)}" data-bf-off="${off ? 1 : 0}"
      style="display:grid;grid-template-columns:auto 1fr auto;gap:0.2rem 0.6rem;align-items:center;margin:0.3rem 0;padding:0.4rem 0.6rem;border-radius:4px;
             background:rgba(0,0,0,0.25);border:1px solid var(--color-border-dark,rgba(0,0,0,0.4));border-left:3px solid ${off ? "rgb(120,120,120)" : "rgb(222,120,40)"};${off ? "opacity:0.55;" : ""}">
      <input type="checkbox" name="bf-metamagic" value="${esc(row.key)}" ${current === row.key ? "checked" : ""} ${off ? "disabled" : ""} style="margin:0;">
      <label style="font-weight:bold;cursor:pointer;">${esc(row.feature)}</label>
      <span style="font-size:var(--font-size-11,11px);letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap;opacity:0.8;">${esc(row.tag)}</span>
      ${sub}
      ${foldedRuleHTML(rule)}
    </div>`;
}

/* ---------------------------------------------------------------------------------------------
 * Transmuted Spell: every damage roll of the cast wears the picked type (Stage 3, 2026-09-09)
 * ------------------------------------------------------------------------------------------- */

/** The metamagic record on the card a roll names as its origin, or on the activity's newest card. */
function recordForRoll(activity, message) {
  try {
    const data = message?.data ?? {};
    const id = data["flags.dnd5e.originatingMessage"] ?? foundry.utils.getProperty(data, "flags.dnd5e.originatingMessage") ?? null;
    const card = id ? game.messages.get(id) : null;
    const record = card?.getFlag(MODULE_ID, METAMAGIC_FLAG) ?? null;
    if ( record ) return record;
    // No origin named (a roll from the sheet): the activity's newest card of the last minute.
    const recent = game.messages.contents.slice(-40).reverse().find(m => (m.getFlag("dnd5e", "activity")?.uuid === activity?.uuid)
      && m.getFlag(MODULE_ID, METAMAGIC_FLAG) && (Math.abs(Date.now() - (m.timestamp ?? 0)) <= 60_000));
    return recent?.getFlag(MODULE_ID, METAMAGIC_FLAG) ?? null;
  } catch { return null; }
}

// The emanation damage-type idiom (emanations.js): the roll's `options.type` is what the verdict
// and the applier read, so the change lands there, on the roller's client, before the dice.
Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
  try {
    const activity = config.subject;
    if ( activity?.item?.type !== "spell" ) return;
    const record = recordForRoll(activity, message);
    if ( (record?.key !== "transmuted") || !record.type ) return;
    const to = lower(record.type);
    let changed = false;
    for ( const roll of config.rolls ?? [] ) {
      const was = lower(roll.options?.type ?? "");
      if ( !TRANSMUTED_TYPES.includes(was) || (was === to) ) continue;
      roll.options ??= {};
      roll.options.type = to;
      if ( Array.isArray(roll.options.types) ) roll.options.types = [to];
      changed = true;
    }
    if ( changed ) foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.metamagicType`, { type: to, feature: record.feature });
  } catch(err) {
    console.warn(`${TITLE} | Transmuted Spell could not set the damage type — the roll wears the spell's own.`, err);
  }
});

/* ---------------------------------------------------------------------------------------------
 * The card: born with the pick; the points spent once the cast has landed
 * ------------------------------------------------------------------------------------------- */

Hooks.on("preCreateChatMessage", doc => {
  try {
    const uuid = doc.getFlag("dnd5e", "activity")?.uuid ?? null;
    if ( !uuid || !pending.has(uuid) ) return;
    const isUsage = (doc.type === "usage") || (doc.getFlag("dnd5e", "messageType") === "usage");
    if ( !isUsage ) return;
    const pick = pending.get(uuid);
    if ( (Date.now() - (pick.at ?? 0)) > PICK_TTL_MS ) { pending.delete(uuid); return; }   // a stale pick is nobody's
    pick.born = true;
    const { born, at, ...record } = pick;
    void born; void at;
    const flags = { [MODULE_ID]: { [METAMAGIC_FLAG]: { ...record, spent: false, ...statContext(pick.actorUuid ?? null) } } };
    // THE DEFERRED CARD (user, 2026-09-09: "the animation fires right away, presumably because the
    // card is posted right away. Is there a way the card can be deferred until the person picks?").
    // A Careful or Heightened cast whose pick waits for the AREA — nothing chosen in the window, a
    // template to place — keeps its card's data here and cancels the birth; the system places the
    // template regardless, the ask opens off a small carrier when the area has landed, and the real
    // card — the animation everyone keys on, the dice, the saves — is posted on the answer.
    const activity = resolveUuid(uuid);
    const areaComing = ((record.key === "careful") || (record.key === "heightened")) && !record.chosen && !!activity?.target?.template?.type;
    if ( areaComing ) {
      const data = doc.toObject();
      data.flags = foundry.utils.mergeObject(data.flags ?? {}, flags);
      deferredCards.set(uuid, { data, pick: record, actorUuid: pick.actorUuid ?? null });
      openCastHold(uuid);
      return false;
    }
    doc.updateSource({ flags });
  } catch(err) { console.warn(`${TITLE} | The metamagic pick could not be stamped on the card.`, err); }
});

/** activity uuid → the usage card held back until the caster has answered the ask at the area. */
const deferredCards = new Map();
const DEFERRED_FLAG = "metamagicDeferred";

/* ---------------------------------------------------------------------------------------------
 * THE CAST HOLD — metamagic's one use of the hold registry ([holds.js](holds.js), which owns the
 * shape and the public api; this file owns only WHEN a cast is held, and every way the question
 * can stop standing). While the ask at the area is up the cast's card does not exist, so a module
 * that keys on the card is told *not yet* rather than shown a picture for a spell nobody has
 * aimed yet (FX Studio, 2026-09-09; the user: "the animation still fires").
 *
 * ⚠ EVERY PATH THAT ENDS THE QUESTION MUST RELEASE, and they are not all happy ones: the answer,
 * the clock, an area with nobody in it, a carrier that could not post, a carrier somebody DELETED,
 * and the real card's BIRTH. The last is why the release below is on `preCreateChatMessage` and
 * not on `createChatMessage`: create hooks fire DURING the create, so a consumer reading the
 * released card on `createChatMessage` would otherwise find the hold still open — for the very
 * card that lifts it.
 * ------------------------------------------------------------------------------------------- */

/** Slack over the ask's own clock before a hold gives up on itself — the answer still has to write. */
const HOLD_SLACK_MS = 30_000;

/**
 * Raise metamagic's hold on a cast, bounded by the ask's own clock when it has one. A clockless
 * ask gets a clockless hold on purpose: a moment waits forever only by explicit setting
 * (ARCHITECTURE §5 law 11), and a self-bound under one would lift while the caster is still reading.
 */
function openCastHold(uuid) {
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  raiseHold(uuid, { reason: "metamagic-ask", bound: window ? ((window * 1000) + HOLD_SLACK_MS) : null });
}

// The real card's BIRTH lifts the hold, before any `createChatMessage` handler can observe it...
Hooks.on("preCreateChatMessage", doc => {
  const uuid = doc.getFlag?.("dnd5e", "activity")?.uuid ?? null;
  if ( uuid && doc.getFlag?.(MODULE_ID, METAMAGIC_FLAG)?.chosen ) releaseHold(uuid, doc);
});
// ...and a card posted from ANOTHER client (the elect's clock kept the default) fires no preCreate
// here, so its arrival lifts the hold too. Both roads are idempotent; whichever runs first wins.
Hooks.on("createChatMessage", message => {
  const uuid = message.getFlag("dnd5e", "activity")?.uuid ?? null;
  if ( uuid && message.getFlag(MODULE_ID, METAMAGIC_FLAG)?.chosen ) releaseHold(uuid, message);
});

// A DELETED CARRIER is the ask withdrawn by hand, and it used to strand the hold forever — this
// was the only moment machine in the module with no `deleteChatMessage` handler (found 2026-09-09
// while writing the hold's contract down). The cast happened and the points are spent, so the
// honest repair is the one the failed-carrier road already takes: post the card as cast, which
// releases the hold on its way past. ⚠ The GUARD is the hold itself — only the client that cast
// holds one, so exactly one client does this, by construction.
Hooks.on("deleteChatMessage", message => {
  try {
    const ask = message.getFlag(MODULE_ID, METAMAGIC_ASK_FLAG);
    const held = message.getFlag(MODULE_ID, DEFERRED_FLAG);
    if ( !held || (ask?.status !== "pending") ) return;
    const uuid = held.activityUuid ?? held.pick?.activityUuid ?? "";
    if ( !isHeld(uuid) ) return;
    console.warn(`${TITLE} | The ask at the area was deleted — posting ${held.pick?.feature ?? "the cast"}'s card as cast.`);
    void postDeferredCard({ data: held.data, pick: held.pick }, held.poolSpend ?? null, null, held.templateIds ?? []);
  } catch(err) { console.error(`${TITLE} | The deleted ask's card could not be posted.`, err); }
});

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  try {
    const pick = pending.get(activity?.uuid);
    if ( !pick ) return;
    pending.delete(activity.uuid);
    const held = deferredCards.get(activity.uuid);
    if ( held ) {
      deferredCards.delete(activity.uuid);
      void carryDeferredCard(activity, held, (results?.templates ?? []).flat().filter(t => t?.parent));
      return;
    }
    const message = (results?.message instanceof ChatMessage) ? results.message : null;
    void spendForPick(activity, pick, message);
  } catch(err) { console.error(`${TITLE} | The metamagic spend failed — spend the Sorcery Points by hand.`, err); }
});

/**
 * The deferred card's road: the points are spent now (the cast happened); if the area holds
 * anyone, a CARRIER — a whisper to the caster and the GM, wearing the ask flag and the held card —
 * asks the question, and the answer posts the real card; an area with nobody in it, or no area at
 * all, posts the card at once (the demand's adoption road asks later if a template ever lands).
 */
async function carryDeferredCard(activity, held, templates) {
  const actor = activity?.actor;
  const pool = held.pick.poolId ? actor?.items?.get(held.pick.poolId) : null;
  const record = pool ? await spendPoolUses(actor, pool, held.pick.feature, held.pick.cost ?? 1, POOL_NAME) : null;
  if ( !pool ) console.warn(`${TITLE} | ${held.pick.feature}: no Sorcery Points pool on ${actor?.name} — nothing spent.`);
  const contained = tokensInTemplates(templates) ?? [];
  const templateIds = templates.map(t => t.id);
  if ( !contained.length ) { await postDeferredCard(held, record, null, templateIds); return; }
  const uuid = activity.uuid;
  const carrierMade = await (async () => {
  const casterTok = tokenOfActor(actor) ?? null;
  const casterDisposition = casterTok?.document?.disposition ?? actor?.prototypeToken?.disposition ?? CONST.TOKEN_DISPOSITIONS.FRIENDLY;
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  const whisper = [...new Set([...(actor ? game.users.filter(u => actor.testUserPermission(u, "OWNER")).map(u => u.id) : []), ...game.users.filter(u => u.isGM).map(u => u.id)])];
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }), whisper,
    content: bfCard({ img: actor?.items?.find(i => i.name === held.pick.feature)?.img ?? null, eyebrow: `Metamagic — ${held.pick.feature}`, tone: "pending",
      title: held.pick.key === "careful" ? "Who does the spell spare?" : "Who saves at Disadvantage?", subtitle: `${activity.item?.name ?? "the spell"} — the card follows the answer` }),
    flags: { [MODULE_ID]: {
      [METAMAGIC_ASK_FLAG]: {
        status: "pending", kind: held.pick.key, feature: held.pick.feature, cap: held.pick.cap ?? 1, rule: held.pick.rule ?? metamagicRuleText(actor?.items?.find(i => i.name === held.pick.feature)?.system?.description?.value ?? ""),
        candidates: contained.map(c => ({ uuid: c.uuid, name: c.name, disposition: c.disposition ?? null, tokenId: c.tokenId ?? null, party: isPartyMember(c.uuid) })),
        casterUuid: actor?.uuid ?? null, casterDisposition, casterName: actor?.name ?? null,
        ...statContext(actor?.uuid ?? null),
        ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
      },
      [DEFERRED_FLAG]: { data: held.data, pick: held.pick, poolSpend: record, templateIds, activityUuid: activity.uuid }
    } }
  }); return true; })().catch(err => { console.error(`${TITLE} | The ask's carrier could not be posted — the card posts as cast.`, err); return false; });
  if ( !carrierMade ) await postDeferredCard(held, record, null, templateIds);
  void uuid;
}

/** The real card, at last: the held data with the pick made chosen and the spend on it; the demand's stamp follows by hook. */
async function postDeferredCard(held, record, answer, templateIds) {
  const data = foundry.utils.deepClone(held.data);
  const mm = foundry.utils.getProperty(data, `flags.${MODULE_ID}.${METAMAGIC_FLAG}`) ?? {};
  foundry.utils.setProperty(data, `flags.${MODULE_ID}.${METAMAGIC_FLAG}`, { ...mm, spent: !!record, ...(answer ?? {}) });
  if ( record ) foundry.utils.setProperty(data, `flags.${MODULE_ID}.poolSpend`, record);
  if ( !game.users.get(data.author)?.active || (data.author !== game.user.id && !game.user.isGM) ) data.author = game.user.id;
  const card = await ChatMessage.create(data);
  if ( !card ) { releaseHold(held.pick.activityUuid ?? "", null); return null; }
  releaseHold(held.pick.activityUuid ?? "", card);
  const activity = resolveUuid(held.pick.activityUuid ?? "") ?? null;
  const scene = canvas.scene ?? game.scenes.active;
  const templates = (templateIds ?? []).map(id => scene?.templates?.get(id)).filter(Boolean);
  Hooks.callAll("battleflow.deferredUsageCard", { activity, message: card, templates });
  return card;
}

async function spendForPick(activity, pick, message) {
  const actor = activity?.actor;
  const pool = pick.poolId ? actor?.items?.get(pick.poolId) : null;
  if ( !pool ) { console.warn(`${TITLE} | ${pick.feature}: no Sorcery Points pool on ${actor?.name} — nothing spent.`); return; }
  const record = await spendPoolUses(actor, pool, pick.feature, pick.cost ?? 1, POOL_NAME);
  if ( !message || !record ) return;
  // ⚠ Not the birth flag: the card exists before the spend, and this write is what the flash's
  // `updateChatMessage` reader catches (resources.js — Parry's answer arrives the same way).
  await message.update({ flags: { [MODULE_ID]: { poolSpend: record, [METAMAGIC_FLAG]: { ...(message.getFlag(MODULE_ID, METAMAGIC_FLAG) ?? pick), spent: true } } } });
}

/* ---------------------------------------------------------------------------------------------
 * The durable record — one line on the spell's card, every render, idempotent (law 6)
 * ------------------------------------------------------------------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const record = message.getFlag(MODULE_ID, METAMAGIC_FLAG);
    if ( !record ) return;
    if ( message.getFlag(MODULE_ID, METAMAGIC_ASK_FLAG)?.status === "pending" ) return;   // the ask's own line speaks
    const content = html.querySelector?.(".message-content") ?? html;
    if ( !content || content.querySelector(".bf-metamagic-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-metamagic-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-wand-sparkles" data-tooltip="Metamagic"></i> ${esc(metamagicCardLine(record))}`;
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The metamagic line could not render.`, err); }
});

/* ---------------------------------------------------------------------------------------------
 * Empowered Spell: a fold on the spell's damage dice (the metamagic pass, Stage 4, 2026-09-09;
 * user: "let's try default")
 *
 * THE MOMENT is the damage roll. When a spell's damage lands on the caster's own client, a popup
 * shows the dice as chips; the caster ticks up to CHA-mod of them and presses Reroll, or keeps
 * the roll; the buzzer keeps it. Reroll spends the point BY HAND (the record on the damage
 * message — the flash and the card line read it), rerolls the ticked dice, and PATCHES THE
 * MESSAGE'S OWN ROLL the way the dice rules do: the old face stays, struck through and inactive,
 * the new face joins active, and the total moves — so every reader downstream (the verdicts, the
 * appliers) sees the new number without knowing why, and the card shows both. The rolled-result
 * obligation (§11 rule 4) is carried the honest way: damage ALREADY applied off this message (a
 * receipt stands) is moved by the difference through the one applier, as its own receipt, on the
 * elect; a client that cannot apply says so in a whisper. Empowered stands outside the one-per-cast
 * rule by its own text, so a Careful or Transmuted cast can still take it.
 * ------------------------------------------------------------------------------------------- */

const EMPOWERED_FLAG = "empowered";
const empoweredTimers = new Map();
// ⚠ dnd5e dispatches the damage hook TWICE per roll (the literal `dnd5e.rollDamageV2` and the templated
// `dnd5e.roll${name}V2` — measured 2026-09-09: "fired 2 for this roll"), and the never-re-stamp read
// cannot see a setFlag still in flight. One in-flight set per moment keeps the offer, the popup and
// the spend single.
const empoweredOffering = new Set();
const empoweredResolving = new Set();

/** The dice a damage message shows — every active face of every die term, keyed `roll:term:index`. */
function empoweredDice(rolls) {
  const out = [];
  (rolls ?? []).forEach((roll, i) => {
    (roll?.terms ?? []).forEach((term, j) => {
      if ( !Number.isFinite(term?.faces) || !Array.isArray(term.results) ) return;
      term.results.forEach((r, k) => {
        if ( r.active === false ) return;
        out.push({ key: `${i}:${j}:${k}`, roll: i, term: j, index: k, faces: term.faces, result: r.result });
      });
    });
  });
  return out;
}

Hooks.on("dnd5e.rollDamageV2", (rolls, data) => {
  try { void offerEmpowered(rolls, data?.subject ?? null); }
  catch(err) { console.error(`${TITLE} | Empowered Spell's offer failed.`, err); }
});

async function offerEmpowered(rolls, activity) {
  if ( !activity || (activity.item?.type !== "spell") ) return;
  const actor = activity.actor;
  if ( !actor?.isOwner ) return;
  const message = rolls?.[0]?.parent;
  if ( !(message instanceof ChatMessage) ) return;
  if ( message.getFlag(MODULE_ID, EMPOWERED_FLAG) || empoweredOffering.has(message.id) ) return;   // never re-stamp
  const item = knownOptions(actor).get("Empowered Spell");
  if ( !item ) return;
  empoweredOffering.add(message.id);
  try { await stampEmpowered(message, actor, item); }
  finally { empoweredOffering.delete(message.id); }
}

async function stampEmpowered(message, actor, item) {
  const pool = poolFor(actor, item);
  const cost = costOf(item) ?? 1;
  if ( !pool || ((pool.system?.uses?.value ?? 0) < cost) ) return;
  const dice = empoweredDice(message.rolls);
  if ( !dice.length ) return;
  const cap = Math.max(1, Number(actor.system?.abilities?.cha?.mod) || 1);
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  await message.setFlag(MODULE_ID, EMPOWERED_FLAG, {
    status: "pending", feature: "Empowered Spell", actorUuid: actor.uuid, poolId: pool.id, cost, cap, dice,
    oldTotal: (message.rolls ?? []).reduce((sum, r) => sum + (Number(r.total) || 0), 0),
    rule: metamagicRuleText(item.system?.description?.value ?? ""),
    ...statContext(actor.uuid),
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
  });
  armAskTimer(empoweredTimers, message, EMPOWERED_FLAG, live => keepEmpowered(live, { timedOut: true }));
  // The table sees the dice land before the question about them opens (the verdict pause's rule).
  await dramaticVerdictPause(message);
  await showEmpoweredPopup(message);
}

/** The picked chips in a popup's form, in the order they were ticked. */
const picksIn = form => [...(form?.querySelectorAll?.('[data-bf-die][data-picked="1"]') ?? [])]
  .sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order)).map(b => b.dataset.bfDie);

async function showEmpoweredPopup(message) {
  const flag = message.getFlag(MODULE_ID, EMPOWERED_FLAG);
  if ( !flag || (flag.status !== "pending") ) return;
  const actor = resolveUuid(flag.actorUuid);
  if ( !actor ) return;
  const pool = actor.items?.get(flag.poolId) ?? null;
  // Eight to a row (user, 2026-09-09: "make this horizontal rows, 8 die per row").
  const chips = flag.dice.map(d => `<button type="button" data-bf-die="${esc(d.key)}" data-picked="0" data-tooltip="d${d.faces}"
      style="width:2.2rem;height:2.2rem;margin:0;padding:0;font-weight:bold;${d.result <= 2 ? "color:#b4463c;" : ""}">${d.result}</button>`).join("");
  await openMomentPopup(message, EMPOWERED_FLAG, actor, {
    title: `Empowered Spell — ${actor.name}`, icon: "fa-solid fa-wand-sparkles", width: 460,
    content: bfCard({
      img: actor.items?.find(i => i.name === "Empowered Spell")?.img ?? null,
      eyebrow: "Metamagic — Empowered Spell", tone: "pending",
      title: `${flag.oldTotal} damage — reroll up to ${flag.cap} ${flag.cap === 1 ? "die" : "dice"}?`,
      subtitle: `${POOL_NAME}: ${pool?.system?.uses?.value ?? "?"} of ${pool?.system?.uses?.max ?? "?"} · ${flag.cost} SP`,
      lines: [ruleLine(flag.rule)]
    }) + `<div data-bf-empowered-dice data-cap="${flag.cap}" style="margin:0.4rem 0;display:grid;grid-template-columns:repeat(8, 2.2rem);gap:0.3rem;justify-content:start;">${chips}</div>` + holdBarHTML(flag, "to answer"),
    buttons: [
      // THE WINDOW GOES AT THE CLICK (user, 2026-09-10: "when you pick the dice and roll, kinda lags
      // closing"). DialogV2 AWAITS a button's callback before it closes, and the resolution now waits
      // out the dice - so a callback that returned the resolution held the window open for the whole
      // animation. The picks are read while the form is still in the DOM; the work is fired, not awaited.
      { action: "reroll", label: "Reroll the picked dice", default: true, callback: (event, button) => { const picks = picksIn(button.form); void resolveEmpowered(message, picks); } },
      { action: "keep", label: "Keep the roll", callback: () => { void keepEmpowered(message); } }
    ]
  });
}

// The chips toggle by delegation — the popup's element is the dialog's own, and one listener on
// the document serves every open popup. The cap is enforced as the ticks are made.
Hooks.once("ready", () => document.addEventListener("click", ev => {
  const chip = ev.target?.closest?.("[data-bf-die]");
  if ( !chip ) return;
  ev.preventDefault();
  const box = chip.closest("[data-bf-empowered-dice]");
  const cap = Number(box?.dataset?.cap) || 99;
  const picked = [...(box?.querySelectorAll('[data-picked="1"]') ?? [])];
  if ( chip.dataset.picked === "1" ) { chip.dataset.picked = "0"; chip.style.outline = ""; return; }
  if ( picked.length >= cap ) return;
  chip.dataset.picked = "1"; chip.dataset.order = String(Date.now()); chip.style.outline = "2px solid rgb(222,120,40)";
}));

async function keepEmpowered(message, { timedOut = false } = {}) {
  await queueFlagWrite(message, EMPOWERED_FLAG, current => {
    if ( current.status !== "pending" ) return false;
    current.status = "kept";
    if ( timedOut ) current.timedOut = true;
  });
}

async function resolveEmpowered(message, picks) {
  if ( empoweredResolving.has(message.id) ) return;
  empoweredResolving.add(message.id);
  let record = null;   // the spend, once it has happened - the failure path below must not lose it
  try {
    const flag = message.getFlag(MODULE_ID, EMPOWERED_FLAG);
    if ( !flag || (flag.status !== "pending") ) return;
    const chosen = empoweredPlan({ dice: flag.dice, picks, cap: flag.cap });
    if ( !chosen.length ) { await keepEmpowered(message); return; }
    const actor = resolveUuid(flag.actorUuid);
    const pool = actor?.items?.get(flag.poolId) ?? null;
    if ( !actor || !pool ) return;
    // ANSWERED IS NOT PENDING (the d20 folds' rule, the same day). The status leaves "pending" HERE,
    // before the spend, the roll and the dice: the updateChatMessage handler below closes any popup
    // and stands the buzzer down, the card says the dice are rolling, and the clock can no longer
    // "keep" a roll the caster has already chosen to reroll.
    await queueFlagWrite(message, EMPOWERED_FLAG, current => {
      if ( current.status !== "pending" ) return false;
      current.status = "answering";
      current.answered = chosen.map(d => d.key);
    });
    if ( message.getFlag(MODULE_ID, EMPOWERED_FLAG)?.status !== "answering" ) return;   // somebody else got there
    record = await spendPoolUses(actor, pool, "Empowered Spell", flag.cost, POOL_NAME);
    // THE DICE ARE ONE ROLL, AND THEY RIDE THE ANNOUNCE CARD (user, 2026-09-10: "on a reroll, the
    // dice so nice, if avail, should roll again"). The module's other rerolls post their die as a
    // message (`roll.toMessage`, d20-folds.js) and Dice So Nice animates it on the create, unasked;
    // this one PATCHES the damage message's own roll instead, so a fresh Roll per die evaluated in
    // memory was never seen by anyone. So: the ticked dice are rolled as ONE Roll, in pick order,
    // and that Roll is the announce card's — the card every roll-reader and DSN already keys on. No
    // DSN-specific call; a table without it loses nothing.
    const data = (message.rolls ?? []).map(r => r.toJSON());
    const live = chosen.filter(d => data[d.roll]?.terms?.[d.term]?.results?.[d.index]);
    if ( !live.length ) { await keepEmpowered(message); return; }
    const fresh = await new Roll(live.map(d => `1d${d.faces}`).join(" + ")).evaluate();
    const faces = fresh.dice.map(die => die.results.find(r => r.active !== false)?.result ?? die.total);
    const done = [];
    live.forEach((d, i) => {
      const term = data[d.roll].terms[d.term];
      const old = term.results[d.index];
      old.active = false; old.rerolled = true;
      term.results.push({ result: faces[i], active: true });
      done.push({ key: d.key, old: old.result, new: faces[i] });
    });
    const rebuilt = data.map(rd => { const r = Roll.fromData(rd); r._total = r._evaluateTotal(); return r; });
    const outcome = empoweredOutcome({ oldTotal: flag.oldTotal, picks: done });
    // The dice land BEFORE the total moves — the same order every verdict in the module keeps
    // (dramaticVerdictPause: capped, cosmetic, never blocking).
    const announce = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [fresh],
      content: bfCard({ img: actor.items?.find(i => i.name === "Empowered Spell")?.img ?? null,
        eyebrow: "Metamagic — Empowered Spell", tone: outcome.delta >= 0 ? "good" : "neutral",
        title: `Empowered Spell — ${outcome.line}`,
        subtitle: spendPhrase(record ? [record] : [], "Sorcery Point") || `${POOL_NAME} spent`,
        lines: [outcome.delta === 0 ? "The total stands." : `The damage is ${outcome.newTotal} now — the new rolls stand.`] }),
      flags: { [MODULE_ID]: { respondsTo: message.id } }
    });
    // THE DURABLE INTENT, BEFORE THE PAUSE (the 2026-09-10 review). The pause is seconds, and a
    // client that died inside it used to leave "answering" for ever: the point gone from the sheet,
    // nothing on the message, the dice never patched. So everything the completion needs is written
    // FIRST - the spend where every spend is read, the patched rolls, the picks, the outcome - and
    // the completion is one idempotent step that this client takes after the dice, and that the
    // elect's resume takes instead if this client never does (registerResumable, below).
    await queueFlagWrite(message, EMPOWERED_FLAG, current => {
      if ( current.status !== "answering" ) return false;
      current.pending = { rolls: rebuilt.map(r => JSON.stringify(r.toJSON())), picks: done, newTotal: outcome.newTotal, delta: outcome.delta, at: Date.now() };
    });
    if ( record ) await message.setFlag(MODULE_ID, "poolSpend", record);
    if ( announce ) await dramaticVerdictPause(announce);
    await completeEmpowered(message);
  } catch(err) {
    console.error(`${TITLE} | Empowered Spell's reroll failed — reroll the dice by hand.`, err);
    // Never strand "answering", and never offer a second point for the same dice: if nothing was
    // spent the offer comes back; if the point went, the moment is used, the spend is recorded on
    // the message like every spend (the flash and the ledger read it there), and the error above
    // says the dice are the caster's to reroll by hand.
    const spent = record;
    if ( message.getFlag(MODULE_ID, EMPOWERED_FLAG)?.pending ) { await completeEmpowered(message).catch(() => {}); }
    else {
      await queueFlagWrite(message, EMPOWERED_FLAG, current => {
        if ( current.status !== "answering" ) return false;
        current.status = spent ? "used" : "pending";
        if ( !spent ) delete current.answered;
      }).catch(() => {});
      if ( spent && !message.getFlag(MODULE_ID, "poolSpend") ) await message.setFlag(MODULE_ID, "poolSpend", spent).catch(() => {});
    }
  } finally {
    empoweredResolving.delete(message.id);
  }
}

/**
 * THE COMPLETION - the one step between "answering" and "used": the patched rolls onto the message,
 * the picks and the outcome onto the flag, the applied damage moved. Idempotent by status: the first
 * writer flips "answering" to "used" and the second finds nothing to do. The clicking client takes it
 * after the dice; the elect's resume takes it instead when that client never does.
 */
async function completeEmpowered(message) {
  const flag = message.getFlag(MODULE_ID, EMPOWERED_FLAG);
  if ( (flag?.status !== "answering") || !flag.pending ) return;
  const { rolls, picks, newTotal, delta } = flag.pending;
  const { pending: _done, answered: _keys, ...rest } = flag;
  void _done; void _keys;
  await message.update({
    rolls,
    flags: { [MODULE_ID]: { [EMPOWERED_FLAG]: { ...rest, status: "used", picks, newTotal, delta, "-=pending": null, "-=answered": null } } }
  });
  await moveAppliedDamage(message, { newTotal, delta });
}

/** Past the longest the pause can be (six seconds of dice, up to ten of dramatic beat), with slack. */
const EMPOWERED_RESUME_MS = 20_000;
registerResumable(EMPOWERED_FLAG, {
  pending: flag => (flag?.status === "answering") && !!flag.pending && ((Date.now() - (flag.pending.at ?? 0)) > EMPOWERED_RESUME_MS),
  drives: () => isActiveGM(),
  drive: message => completeEmpowered(message)
});

/**
 * Damage ALREADY applied off this message is moved by the difference — the §11 rule 4 obligation
 * carried through the one applier, as its own receipt (revertable like any other). A rerolled
 * total that fell heals the difference back the same way.
 */
async function moveAppliedDamage(message, outcome) {
  const receipt = message.getFlag(MODULE_ID, "receipt");
  const targets = (receipt?.targets ?? []).filter(t => !t.reverted);
  if ( !targets.length || !outcome.delta ) return;
  const type = message.rolls?.[0]?.options?.type ?? null;
  if ( !isActiveGM() ) {
    await whisperNoGM(`Empowered Spell moved the damage by ${outcome.delta > 0 ? "+" : ""}${outcome.delta} on ${targets.map(t => t.name).join(", ")} — already applied; adjust by hand`);
    return;
  }
  for ( const t of targets ) {
    const multiplier = Number(t.multiplier ?? 1) || 1;
    const amount = Math.abs(outcome.delta);
    const damages = outcome.delta > 0 ? [{ value: amount, type }] : [{ value: amount, type: "healing" }];
    await applyDamagesWithReceipt(message, [{ uuid: t.uuid, name: t.name }], damages,
      { note: outcome.delta > 0 ? "Empowered Spell — the reroll" : "Empowered Spell — rerolled lower", multiplier });
  }
}

// The card while the fold is pending: the offer and a recall; the elect arms the buzzer on render
// (a player's roll stamps on the player's client, where armAskTimer is a no-op — the folds' lesson).
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, EMPOWERED_FLAG);
    if ( !flag ) return;
    const content = html.querySelector?.(".message-content") ?? html;
    if ( !content || content.querySelector(".bf-empowered-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-empowered-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    if ( flag.status === "pending" ) {
      div.innerHTML = `<i class="fa-solid fa-wand-sparkles" data-tooltip="Metamagic"></i> Empowered Spell — offered: reroll up to ${flag.cap} ${flag.cap === 1 ? "die" : "dice"} ${holdBarHTML(flag, "to answer")}`;
      const actor = resolveUuid(flag.actorUuid);
      if ( actor?.isOwner ) div.appendChild(momentButton("Answer", () => { void showEmpoweredPopup(message); }));
      scheduleBarSync(div);
      armAskTimer(empoweredTimers, message, EMPOWERED_FLAG, live => keepEmpowered(live, { timedOut: true }));
    } else if ( flag.status === "answering" ) {
      const n = (flag.answered ?? []).length;
      div.innerHTML = `<i class="fa-solid fa-wand-sparkles" data-tooltip="Metamagic"></i> Empowered Spell — answered: rerolling ${n} ${n === 1 ? "die" : "dice"}, the dice are rolling`;
    } else if ( flag.status === "used" ) {
      div.innerHTML = `<i class="fa-solid fa-wand-sparkles" data-tooltip="Metamagic"></i> ${esc(`Empowered Spell — ${empoweredOutcome({ oldTotal: flag.oldTotal, picks: flag.picks ?? [] }).line}`)}`;
    } else {
      div.innerHTML = `<i class="fa-solid fa-wand-sparkles" data-tooltip="Metamagic"></i> Empowered Spell — kept${flag.timedOut ? " (the clock ran out)" : ""}`;
    }
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The Empowered line could not render.`, err); }
});

// A resolved fold closes its popup (law 4) and stands its buzzer down.
Hooks.on("updateChatMessage", message => {
  const flag = message.getFlag(MODULE_ID, EMPOWERED_FLAG);
  if ( !flag || (flag.status === "pending") ) return;
  disarmAskTimer(empoweredTimers, message.id);
  const open = livePopups.get(popupKey(message.id, EMPOWERED_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
});

/* ---------------------------------------------------------------------------------------------
 * THE ASK AT THE AREA (user ruling 2026-09-09, third look): when a Careful or Heightened cast
 * selected nobody in the window and its area has landed, the caster is asked ONCE, of everything
 * the area holds — ticks for Careful (the party pre-ticked up to the cap, then the caster's side,
 * then neutrals), a radio for Heightened (the first hostile by default) — in two groups, the
 * PARTY and everyone else, a tick pinging the token on the map so the name can be matched to the
 * creature. The save demand waits, empty and clockless, until the answer fills it: the targets
 * minus the protected, the deadline from then. The clock keeps the default. saves/demand.js
 * raises the ask flag and holds the demand; this side opens the popup, answers it, fills the
 * demand and releases the clock.
 * ------------------------------------------------------------------------------------------- */

const askTimers = new Map();

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const ask = message.getFlag(MODULE_ID, METAMAGIC_ASK_FLAG);
    if ( !ask ) return;
    const content = html.querySelector?.(".message-content") ?? html;
    if ( !content || content.querySelector(".bf-metamagic-ask") ) return;
    if ( ask.status !== "pending" ) return;
    const div = document.createElement("div");
    div.className = "bf-metamagic-ask";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-wand-sparkles" data-tooltip="Metamagic"></i> ${esc(ask.feature)} — ${ask.kind === "careful" ? "who does the spell spare?" : "who saves at Disadvantage?"} ${holdBarHTML(ask, "to answer")}`;
    const caster = resolveUuid(ask.casterUuid);
    if ( caster && canAnswerFor(caster) ) div.appendChild(momentButton("Answer", () => { void showMetamagicAsk(message); }));
    scheduleBarSync(div);
    content.appendChild(div);
    armAskTimer(askTimers, message, METAMAGIC_ASK_FLAG, live => answerMetamagicAsk(live, null, { timedOut: true }));
    if ( caster && canAnswerFor(caster) ) void showMetamagicAsk(message);
  } catch(err) { console.warn(`${TITLE} | The metamagic ask could not render.`, err); }
});

/** The ask's popup: the party, then everyone else in the area, the defaults ticked; OK answers, the clock keeps the default. */
async function showMetamagicAsk(message) {
  const ask = message.getFlag(MODULE_ID, METAMAGIC_ASK_FLAG);
  if ( !ask || (ask.status !== "pending") ) return;
  const caster = resolveUuid(ask.casterUuid);
  if ( !caster ) return;
  const defaults = new Set(askDefaults(ask).map(c => c.uuid));
  const careful = ask.kind === "careful";
  const side = c => (c.disposition === ask.casterDisposition) ? "" : (c.disposition === 0 ? " <span style='opacity:0.7'>(neutral)</span>" : " <span style='opacity:0.7'>(hostile)</span>");
  const rowOf = c => `<label style="display:flex;align-items:center;gap:0.4rem;margin:0.2rem 0;cursor:pointer;">
      <input type="${careful ? "checkbox" : "radio"}" name="bf-metamagic-ask" value="${esc(c.uuid)}" data-name="${esc(c.name)}" data-token="${esc(c.tokenId ?? "")}" ${defaults.has(c.uuid) ? "checked" : ""} style="margin:0;"> ${esc(c.name)}${side(c)}</label>`;
  const party = ask.candidates.filter(c => c.party), others = ask.candidates.filter(c => !c.party);
  const group = (title, list) => list.length ? `<div data-bf-ask-group="${title}" style="margin:0.3rem 0;"><div style="font-size:var(--font-size-11,11px);letter-spacing:0.08em;text-transform:uppercase;opacity:0.7;margin:0.2rem 0;">${title}</div>${list.map(rowOf).join("")}</div>` : "";
  await openMomentPopup(message, METAMAGIC_ASK_FLAG, caster, {
    title: `${ask.feature} — ${caster.name}`, icon: "fa-solid fa-wand-sparkles", width: 420,
    content: bfCard({
      img: caster.items?.find(i => i.name === ask.feature)?.img ?? null,
      eyebrow: `Metamagic — ${ask.feature}`, tone: "pending",
      title: careful ? `Who does the spell spare? Up to ${ask.cap}.` : "Who saves at Disadvantage?",
      subtitle: `${ask.candidates.length} in the area — a tick pings the token`,
      lines: [ask.rule ? ruleLine(ask.rule) : ""]
    }) + `<div data-bf-metamagic-ask="${esc(ask.kind)}" data-cap="${ask.cap}" style="margin:0.4rem 0;">${group("Party", party)}${group("Non-Party", others)}</div>` + holdBarHTML(ask, "to answer"),
    buttons: [
      { action: "ok", label: "OK", default: true, callback: (event, button) => answerMetamagicAsk(message, [...button.form.querySelectorAll('input[name="bf-metamagic-ask"]:checked')].map(i => i.value)) }
    ]
  });
}

// A tick pings the creature's token on the map (user, 2026-09-09: "so a person can confirm which"),
// and the cap holds as the ticks are made — one listener, every popup (the Empowered chips' idiom).
Hooks.once("ready", () => document.addEventListener("change", ev => {
  const any = ev.target?.closest?.('input[name="bf-metamagic-ask"]');
  if ( !any ) return;
  if ( any.checked && any.dataset.token ) {
    const tok = canvas.tokens?.get(any.dataset.token);
    if ( tok ) { try { canvas.ping(tok.center); } catch { /* no canvas to ping */ } }
  }
  if ( any.type !== "checkbox" ) return;
  const holder = any.closest("[data-bf-metamagic-ask]");
  const cap = Number(holder?.dataset?.cap) || 99;
  const on = [...(holder?.querySelectorAll('input[name="bf-metamagic-ask"]:checked') ?? [])];
  if ( on.length > cap ) { any.checked = false; return; }
  for ( const b of holder?.querySelectorAll('input[name="bf-metamagic-ask"]') ?? [] ) if ( !b.checked ) b.disabled = on.length >= cap;
}));

/**
 * The answer — the caster's ticks, or the defaults when the clock ran out — written as CHOSEN on
 * the cast's flag; then the demand is filled from the area's creatures minus the protected, the
 * clock started, and the saves machine takes it from there (its asks open on the fill).
 */
async function answerMetamagicAsk(message, picked, { timedOut = false } = {}) {
  try {
    const ask = message.getFlag(MODULE_ID, METAMAGIC_ASK_FLAG);
    if ( !ask || (ask.status !== "pending") ) return;
    const chosen = Array.isArray(picked) ? picked : askDefaults(ask).map(c => c.uuid);
    const named = uuid => ask.candidates.find(c => c.uuid === uuid) ?? null;
    const mm = message.getFlag(MODULE_ID, METAMAGIC_FLAG) ?? {};
    let protectedList = [];
    let mark = null;
    if ( ask.kind === "careful" ) {
      protectedList = chosen.map(named).filter(Boolean).slice(0, Math.max(1, Number(ask.cap) || 1)).map(c => ({ uuid: c.uuid, name: c.name }));
    } else {
      const c = named(chosen[0] ?? null);
      mark = c ? { uuid: c.uuid, name: c.name } : null;
    }
    const rule = mm.rule ?? ask.rule ?? "";
    const held = message.getFlag(MODULE_ID, DEFERRED_FLAG);
    if ( held ) {
      // The deferred card's answer: the pick made chosen on the held data, the real card posted, the
      // carrier gone. The demand, the dice and the saves all follow the card, in that order.
      await message.setFlag(MODULE_ID, METAMAGIC_ASK_FLAG, { ...ask, status: "done", answer: chosen, ...(timedOut ? { timedOut: true } : {}) });
      const answer = { chosen: true, ...(ask.kind === "careful" ? { protected: protectedList } : { target: mark, rule }) };
      await postDeferredCard({ data: held.data, pick: held.pick }, held.poolSpend ?? null, answer, held.templateIds ?? []);
      await message.delete().catch(() => {});
      return;
    }
    await message.update({ flags: { [MODULE_ID]: {
      [METAMAGIC_FLAG]: { ...mm, chosen: true, ...(ask.kind === "careful" ? { protected: protectedList } : { target: mark, rule }) },
      [METAMAGIC_ASK_FLAG]: { ...ask, status: "done", answer: chosen, ...(timedOut ? { timedOut: true } : {}) }
    } } });
    const protectedUuids = new Set(protectedList.map(p => p.uuid));
    const window = Math.max(0, Number(ask.window) || 0);
    await queueFlagWrite(message, "saves", flag => {
      const prev = flag.targets ?? [];
      const fresh = ask.candidates.filter(c => !protectedUuids.has(c.uuid) && !prev.some(t => t.uuid === c.uuid)).map(c => saveTargetEntry(c.uuid, c.name));
      flag.targets = [...prev.filter(t => t.done || !protectedUuids.has(t.uuid)), ...fresh];
      flag.awaitingTemplate = false;
      if ( window ) { flag.window = window; flag.deadline = Date.now() + (window * 1000); }
      if ( mark ) flag.demand = { ...(flag.demand ?? {}), heightened: { ...mark, caster: ask.casterName ?? null, rule } };
      if ( !flag.targets.length ) flag.status = "done";   // everyone spared — nobody owes a save
    });
    // The sequence resumes: the saves machine rolls the dice it deferred while the question stood.
    Hooks.callAll("battleflow.metamagicAskAnswered", message);
  } catch(err) {
    console.error(`${TITLE} | The metamagic ask could not be answered — the demand waits; the card's Answer button reopens it.`, err);
  }
}

// An answered ask closes its popup (law 4) and stands its clock down.
Hooks.on("updateChatMessage", message => {
  const ask = message.getFlag(MODULE_ID, METAMAGIC_ASK_FLAG);
  if ( !ask || (ask.status === "pending") ) return;
  disarmAskTimer(askTimers, message.id);
  const open = livePopups.get(popupKey(message.id, METAMAGIC_ASK_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
});
