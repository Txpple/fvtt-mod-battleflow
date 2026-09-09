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
 * The later moments (Empowered on the damage dice, Seeking on the miss) are Stage 4's and are
 * not here yet; Careful's protected set and Heightened's mark are Stage 2's and ride the same
 * birth flag.
 */
import { MODULE_ID, TITLE, statContext, queueFlagWrite } from "./core.js";
import { lower } from "./lookup.js";
import { saveTargetEntry } from "./decide/demand.js";
import { metamagicEntries, listedNames } from "./settings.js";
import { poolOf, spendPoolUses } from "./shared.js";
import { feetOf } from "./geometry.js";
import { foldedRuleHTML, esc } from "./decide/present.js";
import { METAMAGIC, TRANSMUTED_TYPES, tableIndex } from "./decide/registry.js";
import { METAMAGIC_FLAG, metamagicMenu, metamagicPick, metamagicRuleText, metamagicCardLine, distantRange } from "./decide/metamagic.js";

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
    scalesTargets: false   // Stage 3's question: the pack keeps target scaling in prose
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
    const fs = document.createElement("fieldset");
    fs.dataset.bfMetamagicField = "";
    fs.innerHTML = `<legend>Battle Flow — Metamagic</legend>
      <div data-bf-metamagic-pool style="display:flex;justify-content:space-between;font-size:var(--font-size-12,12px);opacity:0.85;margin:0 0 0.25rem;">
        <span>${esc(actor.name)}</span><span><strong>${POOL_NAME}: ${points} of ${max}</strong>${first ? "" : " — no pool found"}</span></div>
      ${menu.map(row => rowHTML(row, known.get(row.feature), current)).join("")}
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
      const row = menu.find(r => r.key === picked);
      const pick = metamagicPick({ menu, chosen: picked });
      if ( pick ) {
        const item = known.get(pick.feature);
        pending.set(activity.uuid, { key: pick.key, feature: pick.feature, cost: pick.cost, itemUuid: item?.uuid ?? null, actorUuid: actor.uuid,
          poolId: poolFor(actor, item)?.id ?? null,
          ...(pick.key === "distant" ? { rangeFeet: distantRange(facts) } : {}),
          // Careful's cap is the Charisma modifier, minimum one (the option's own words); the
          // protected list itself is derived where the save's reach is known (saves/demand.js).
          ...(pick.key === "careful" ? { cap: Math.max(1, Number(actor.system?.abilities?.cha?.mod) || 1) } : {}),
          // Heightened's rule rides the demand for the save gate's fold (law 8: the feat's own text).
          ...(pick.key === "heightened" ? { rule: metamagicRuleText(item?.system?.description?.value ?? "") } : {}) });
      } else pending.delete(activity.uuid);
    };
    for ( const b of boxes ) b.addEventListener("change", sync);
    sync();
    const footer = element.querySelector("footer, .form-footer");
    if ( footer ) footer.before(fs); else (element.querySelector("form") ?? element).appendChild(fs);
  } catch(err) { console.warn(`${TITLE} | Could not add the metamagic fieldset.`, err); }
});

/** One row: the tick, the name, the tag, the rule folded under — nothing above the fold (the offer-row law). */
function rowHTML(row, item, current) {
  const off = !row.eligible || !row.affordable;
  const rule = metamagicRuleText(item?.system?.description?.value ?? "");
  return `<div data-bf-metamagic-row="${esc(row.key)}" data-bf-off="${off ? 1 : 0}"
      style="display:grid;grid-template-columns:auto 1fr auto;gap:0.2rem 0.6rem;align-items:center;margin:0.3rem 0;padding:0.4rem 0.6rem;border-radius:4px;
             background:rgba(0,0,0,0.25);border:1px solid var(--color-border-dark,rgba(0,0,0,0.4));border-left:3px solid ${off ? "rgb(120,120,120)" : "rgb(222,120,40)"};${off ? "opacity:0.55;" : ""}">
      <input type="checkbox" name="bf-metamagic" value="${esc(row.key)}" ${current === row.key ? "checked" : ""} ${off ? "disabled" : ""} style="margin:0;">
      <label style="font-weight:bold;cursor:pointer;">${esc(row.feature)}</label>
      <span style="font-size:var(--font-size-11,11px);letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap;opacity:0.8;">${esc(row.tag)}</span>
      ${foldedRuleHTML(rule)}
    </div>`;
}

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
    doc.updateSource({ flags: { [MODULE_ID]: { [METAMAGIC_FLAG]: { ...pick, spent: false, ...statContext(pick.actorUuid ?? null) } } } });
  } catch(err) { console.warn(`${TITLE} | The metamagic pick could not be stamped on the card.`, err); }
});

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  try {
    const pick = pending.get(activity?.uuid);
    if ( !pick ) return;
    pending.delete(activity.uuid);
    const message = (results?.message instanceof ChatMessage) ? results.message : null;
    void spendForPick(activity, pick, message);
  } catch(err) { console.error(`${TITLE} | The metamagic spend failed — spend the Sorcery Points by hand.`, err); }
});

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
    const content = html.querySelector?.(".message-content") ?? html;
    if ( !content || content.querySelector(".bf-metamagic-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-metamagic-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-wand-sparkles" data-tooltip="Metamagic"></i> ${esc(metamagicCardLine(record))}`;
    // THE PICKER TO ADJUST (user ruling 2026-09-09, decision 1: "default … picker to adjust"):
    // Careful's protected list and Heightened's mark are derived from the save's reach; the
    // caster (or a GM) can change them from the card while the demand is pending. The button is
    // drawn only where the click can write — the card is the caster's own message.
    const saves = message.getFlag(MODULE_ID, "saves");
    const adjustable = (record.key === "careful") || (record.key === "heightened");
    if ( adjustable && saves && (saves.status === "pending") && message.canUserModify?.(game.user, "update") ) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.bfMetamagicAdjust = record.key;
      b.style.cssText = "margin-left:0.5rem;font-size:var(--font-size-11,11px);line-height:1.4;padding:0 0.4rem;";
      b.textContent = record.key === "careful" ? "Protect…" : "Mark…";
      b.addEventListener("click", ev => { ev.preventDefault(); void adjustDialog(message, record, saves); });
      div.appendChild(b);
    }
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The metamagic line could not render.`, err); }
});

/**
 * The adjust popup: every creature the demand reaches (its pending and done targets, and the
 * protected ones) with a tick each — up to the cap for Careful, one radio for Heightened. OK
 * rewrites the metamagic flag with `chosen: true` (the derivation honours it from then on) and
 * re-derives the demand's targets through the serializer: a newly protected creature leaves
 * (its popup closes — law 4, the dropped-entry sweep), a released one joins as a fresh entry.
 */
async function adjustDialog(message, record, saves) {
  const careful = record.key === "careful";
  const protectedList = record.protected ?? [];
  const candidates = [...(saves.targets ?? []).map(t => ({ uuid: t.uuid, name: t.name, done: !!t.done })), ...protectedList.map(p => ({ uuid: p.uuid, name: p.name, done: false }))]
    .filter((c, i, arr) => arr.findIndex(x => x.uuid === c.uuid) === i);
  if ( !candidates.length ) return;
  const cap = Math.max(1, Number(record.cap) || 1);
  const isOn = c => careful ? protectedList.some(p => p.uuid === c.uuid) : (record.target?.uuid === c.uuid);
  const rows = candidates.map(c => `<label style="display:flex;align-items:center;gap:0.4rem;margin:0.2rem 0;${c.done ? "opacity:0.6;" : ""}">
      <input type="${careful ? "checkbox" : "radio"}" name="bf-metamagic-adjust" value="${esc(c.uuid)}" ${isOn(c) ? "checked" : ""} ${c.done ? "disabled" : ""}> ${esc(c.name)}${c.done ? " (already rolled)" : ""}</label>`).join("");
  const content = `<div data-bf-metamagic-adjust="${esc(record.key)}">
    <p style="margin:0 0 0.4rem;">${careful ? `Protect up to ${cap} — no save, no damage.` : "One creature saves against the spell at Disadvantage."}</p>${rows}</div>`;
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: `${record.feature} — ${message.getFlag(MODULE_ID, "saves")?.item?.name ?? "the spell"}` },
    position: { width: 380 }, content, rejectClose: false,
    buttons: [
      { action: "ok", label: "OK", default: true, callback: (event, button) => [...button.form.querySelectorAll('input[name="bf-metamagic-adjust"]:checked')].map(i => i.value) },
      { action: "cancel", label: "Cancel", callback: () => null }
    ]
  }).catch(() => null);
  if ( !Array.isArray(chosen) ) return;
  await applyAdjustment(message, record, candidates, careful ? chosen.slice(0, cap) : chosen.slice(0, 1));
}

async function applyAdjustment(message, record, candidates, chosen) {
  const nameOf = uuid => candidates.find(c => c.uuid === uuid)?.name ?? uuid;
  const current = message.getFlag(MODULE_ID, METAMAGIC_FLAG) ?? record;
  if ( record.key === "careful" ) {
    const list = chosen.map(uuid => ({ uuid, name: nameOf(uuid) }));
    await message.setFlag(MODULE_ID, METAMAGIC_FLAG, { ...current, protected: list, chosen: true });
    const prot = new Set(chosen);
    await queueFlagWrite(message, "saves", flag => {
      const prev = flag.targets ?? [];
      const kept = prev.filter(t => t.done || !prot.has(t.uuid));
      const back = candidates.filter(c => !c.done && !prot.has(c.uuid) && !prev.some(t => t.uuid === c.uuid)).map(c => saveTargetEntry(c.uuid, c.name));
      const next = [...kept, ...back];
      if ( (next.length === prev.length) && next.every((t, i) => t.uuid === prev[i]?.uuid) ) return false;
      flag.targets = next;
      if ( next.length && next.every(t => t.done) ) flag.status = "done";
    });
    return;
  }
  const uuid = chosen[0] ?? null;
  const target = uuid ? { uuid, name: nameOf(uuid) } : null;
  await message.setFlag(MODULE_ID, METAMAGIC_FLAG, { ...current, target, chosen: true });
  await queueFlagWrite(message, "saves", flag => {
    const mark = target ? { ...target, caster: flag.casterName ?? null, rule: current.rule ?? "" } : null;
    if ( (flag.demand?.heightened?.uuid ?? null) === (mark?.uuid ?? null) ) return false;
    flag.demand = { ...(flag.demand ?? {}) };
    if ( mark ) flag.demand.heightened = mark; else delete flag.demand.heightened;
  });
}
