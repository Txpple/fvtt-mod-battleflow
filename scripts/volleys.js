/**
 * Battle Flow — the volley folds. A volley is a spell that throws N projectiles in one action
 * (Magic Missile's darts, Scorching Ray's rays); the system rolls ONE follow-up per use, so the
 * fold suppresses it and gives the CASTER one popup to aim the whole volley.
 *   - DAMAGE kind (darts): strike simultaneously — one aggregated damage roll per target, so one
 *     application and one concentration check each; aimed by the canvas target around
 *     `rollDamage`, applied by the existing spell-damage machinery (hold/spell-damage.js).
 *   - ATTACK kind (rays): each ray is its own real `rollAttack` through the ordinary pipeline —
 *     damage, holds and riders fire per ray.
 * Membership is volley-registry.js alone (content counts are wrong both ways); the used activity
 * must match the entry's kind and the count be 2+. The claim is `subsequentActions = false` in
 * preUseActivity. Everything runs on the CASTING client; a caster who reloads and never returns
 * leaves the volley unfired (the GM's fallback is the sheet).
 */
import { MODULE_ID, TITLE, S, setting, queueFlagWrite, deadlineIsLive, statContext } from "./core.js";
import { modeAllows } from "./shared.js";
import { volleyEntryFor, resolveVolleyCount } from "./volley-registry.js";
import { castLevelOf, clampVolleyCount } from "./decide/eligible.js";
import { popupKey, bfCard, esc, momentBarHTML, reminderDetailsHTML } from "./decide/present.js";
import { REMINDER_FLAG, reminderRecord } from "./decide/reminders.js";
import { livePopups, openManagedPopup, armDeadline, disarmDeadline } from "./ui.js";
import { tokenForUuid } from "./geometry.js";
import { judgeRoll } from "./reminders.js";
import { SURFACES } from "./surfaces.js";
import { castLevelOn, originData, targetsInData, targetsOf } from "./decide/card.js";
import { cardActivity } from "./lookup.js";

const volleyTimers = new Map();

/* ---------------------------------------------------------------------------------------------
 * Detection
 * ------------------------------------------------------------------------------------------- */

/**
 * Is this use a volley? Null means the fully native path. Targetless casts stay native (nothing
 * to aim). A distinct-targets entry (Steel Wind Strike) clamps n to the target count.
 */
function volleySpec(activity, usageConfig, targetCount, { castLevel } = {}) {
  if ( !setting(S.volleys) ) return null;
  const entry = volleyEntryFor(activity?.item);
  if ( !entry ) return null;
  if ( activity.type !== entry.kind ) return null;
  if ( !activity.damage?.parts?.length ) return null;
  if ( !modeAllows(activity.actor) ) return null;   // the folds ride the resolver
  if ( !(targetCount > 0) ) return null;
  const level = castLevel ?? castLevelOf(activity, usageConfig);
  const n = clampVolleyCount(resolveVolleyCount(entry, activity, level), targetCount,
    entry.distinctTargets);
  if ( n === null ) return null;
  return { n, castLevel: level, distinct: !!entry.distinctTargets };
}

/* ---------------------------------------------------------------------------------------------
 * The claim (preUse) and the stamp (postUse) — both on the casting client
 * ------------------------------------------------------------------------------------------- */

Hooks.on("dnd5e.preUseActivity", (activity, usageConfig, _dialogConfig, messageConfig) => {
  const snapshot = targetsInData(messageConfig?.data);
  const spec = volleySpec(activity, usageConfig, snapshot ? snapshot.length : 0);
  if ( !spec ) return;
  // The claim: no native single follow-up roll — the volley drives every projectile itself.
  usageConfig.subsequentActions = false;
});

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  const message = (results?.message instanceof ChatMessage) ? results.message : null;
  if ( !message ) return;
  const targets = targetsOf(message)
    .map(t => ({ uuid: t.uuid, name: t.name, img: t.img ?? null }));
  // The message's own level is the cast level the system stands behind (castLevelOf); the
  // config is only the fallback.
  const spellLevel = castLevelOn(message) ?? 0;
  const spec = volleySpec(activity, usageConfig, targets.length,
    spellLevel ? { castLevel: spellLevel } : {});
  if ( !spec ) return;
  void stampVolley(activity, message, targets, spec);
});

async function stampVolley(activity, message, targets, spec) {
  try {
    if ( message.getFlag(MODULE_ID, "volley") ) return; // never re-stamp
    // Replicate the consumed-flag write that suppressing subsequentActions skips (Activity#use).
    // It records only hit-dice spends; refunds otherwise ride the message's `system.deltas`.
    try {
      const consumed = activity.createConsumedFlag?.(activity.actor, message.system?.deltas);
      if ( consumed ) activity.item.updateSource({ "flags.dnd5e.consumed": consumed });
    } catch { /* refund keeps working through the deltas either way */ }

    const window = Math.max(0, Number(setting(S.damageTimer)) || 0);
    await message.setFlag(MODULE_ID, "volley", {
      status: "pending",
      ...statContext(activity.actor?.uuid ?? null), // the data-plane stamp — the caster's volley
      kind: activity.type,                       // "damage" (darts) | "attack" (rays)
      n: spec.n,
      castLevel: spec.castLevel,
      activityUuid: activity.uuid,
      item: { name: activity.item?.name ?? "the spell", img: activity.item?.img ?? null },
      casterName: activity.actor?.name ?? null,
      targets,
      ...(spec.distinct ? { distinct: true } : {}),
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
    });
    // This hook already runs on the casting client — the popup is theirs.
    void openVolleyPopup(message);
  } catch(err) {
    console.error(`${TITLE} | Could not stamp the volley.`, err);
  }
}

/* ---------------------------------------------------------------------------------------------
 * The one decision surface — the caster aims the volley
 * ------------------------------------------------------------------------------------------- */

/** Even spread, first targets first — the default the buzzer fires and the popup pre-fills. */
function defaultAssignment(v) {
  if ( v.kind === "damage" ) {
    const rows = v.targets.map(t => ({ uuid: t.uuid, name: t.name, count: 0 }));
    for ( let i = 0; i < v.n; i++ ) rows[i % rows.length].count++;
    return rows;
  }
  // Distinct-targets entries clamped n to the target count at stamp — one each, no wrap.
  return Array.from({ length: v.n }, (_, i) => {
    const t = v.distinct ? v.targets[i] : v.targets[i % v.targets.length];
    return { uuid: t.uuid, name: t.name };
  });
}

/** The projectile noun for copy — darts strike, rays are attacks. Content-agnostic wording. */
const unitNoun = v => (v.kind === "damage") ? "dart" : "ray";

/* ---------------------------------------------------------------------------------------------
 * The gate meets the rays at the aim (RULINGS *A volley meets the gate at its aim*): the rays
 * roll with the dialog suppressed, so the gate's judge runs here once per ray, in ray order,
 * spends carried forward; each ray's mode defaults to its net. Darts are not attack rolls.
 * ------------------------------------------------------------------------------------------- */

/**
 * One judgement per ray, in ray order, the spends carried forward. `picks` are the rays'
 * target uuids as aimed. Null entries where there is no caster or the list is off.
 */
function judgeRays(caster, activity, picks) {
  if ( !(caster instanceof Actor) ) return picks.map(() => null);
  const spent = new Set();
  return picks.map(uuid => {
    const token = tokenForUuid(uuid);
    const j = judgeRoll(caster, { activity, targets: token ? [token] : [], spent, spendNote: " — spent by this ray" });
    for ( const id of (j?.spends ?? []) ) spent.add(id);
    return j;
  });
}

/** Draw — or redraw — every ray row's judgement from the selects as they stand. */
function drawRayJudgements(element, caster, activity) {
  const selects = [...(element?.querySelectorAll?.("[data-bf-volley-ray]") ?? [])];
  if ( !selects.length ) return;
  const judged = judgeRays(caster, activity, selects.map(s => s.value));
  for ( const [i, j] of judged.entries() ) {
    const host = element.querySelector(`[data-bf-volley-judge="${i}"]`);
    if ( !host ) continue;
    if ( j?.sources?.length ) {
      host.innerHTML = reminderDetailsHTML(j.view);
      host.style.display = "";
      const mode = element.querySelector(`[data-bf-volley-mode="${i}"]`);
      if ( mode ) mode.value = j.net;   // the default follows the net — Enter is still a press
    } else {
      host.innerHTML = "";
      host.style.display = "none";
    }
  }
}

async function openVolleyPopup(message) {
  const v = message.getFlag(MODULE_ID, "volley");
  if ( v?.status !== "pending" ) return;
  const key = popupKey(message.id, "volley");
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return; }
  // The rays' judge needs the caster and the activity (range reads the spell's own); a volley
  // whose activity no longer resolves aims without a judgement.
  const activity = (v.kind === "attack") ? cardActivity(message, v.activityUuid) : null;
  const caster = activity?.item?.actor ?? null;

  const noun = unitNoun(v);
  // Every row shows WHO — the target's token icon beside its name; no image degrades to the name.
  const iconHTML = t => t?.img
    ? `<img src="${esc(t.img)}" alt="${esc(t.name)}" data-tooltip="${esc(t.name)}"
        style="width:22px;height:22px;border:none;border-radius:4px;object-fit:cover;flex:0 0 auto;">`
    : "";
  // The ray variant always renders the element (hidden when imageless) so the change listener
  // has something to reveal when the pick moves to a target with an image.
  const rayIconHTML = (i, t) => `<img data-bf-volley-icon="${i}" src="${esc(t?.img ?? "")}"
      alt="${esc(t?.name ?? "")}" ${t?.img ? `data-tooltip="${esc(t.name)}"` : ""}
      style="width:22px;height:22px;border:none;border-radius:4px;object-fit:cover;flex:0 0 auto;${t?.img ? "" : "display:none;"}">`;
  const rows = (v.kind === "damage")
    // One stepper per target: how many darts land there.
    ? v.targets.map((t, _i) => {
      const def = defaultAssignment(v).find(a => a.uuid === t.uuid)?.count ?? 0;
      // [icon] **Name** is targeted [n]
      return `<div style="display:flex;align-items:center;gap:0.5rem;margin:0.15rem 0;">
        ${iconHTML(t)}
        <label style="flex:1;"><strong>${esc(t.name)}</strong> <span style="opacity:0.8;">is targeted</span></label>
        <input type="number" data-bf-volley-uuid="${esc(t.uuid)}" value="${def}"
          min="0" max="${v.n}" step="1" style="width:4rem;text-align:center;">
      </div>`;
    }).join("")
    // One target pick and one mode per ray. "Normal" passes NO override, so sheet-borne modifiers
    // keep applying themselves. The icon tracks the selected target (listener bound after render).
    : Array.from({ length: v.n }, (_, i) => {
      const def = defaultAssignment(v)[i]?.uuid;
      const defTarget = v.targets.find(t => t.uuid === def);
      const options = v.targets.map(t =>
        `<option value="${esc(t.uuid)}" ${t.uuid === def ? "selected" : ""}>${esc(t.name)}</option>`).join("");
      return `<div style="display:flex;align-items:center;gap:0.5rem;margin:0.15rem 0;">
        ${rayIconHTML(i, defTarget)}
        <label style="flex:1;">Ray ${i + 1}</label>
        <select data-bf-volley-ray="${i}" style="width:9.5rem;">${options}</select>
        <select data-bf-volley-mode="${i}" style="width:7.5rem;">
          <option value="normal" selected>Normal</option>
          <option value="advantage">Advantage</option>
          <option value="disadvantage">Disadvantage</option>
        </select>
      </div>
      <div data-bf-volley-judge="${i}" style="display:none;margin:0 0 0.35rem 1.9rem;font-size:var(--font-size-12,12px);"></div>`;
    }).join("");

  const bar = (v.deadline && v.window) ? momentBarHTML({ deadline: v.deadline, window: v.window }, "to aim") : "";
  const dialog = new foundry.applications.api.DialogV2({
    window: { title: `${v.item?.name ?? "Volley"} — ${v.n} ${noun}s`, icon: "fa-solid fa-meteor" },
    position: { width: (v.kind === "attack") ? 480 : 430 },
    content: bfCard({
      img: v.item?.img,
      eyebrow: "Volley — your aim",
      title: `${v.n} ${noun}s to place`,
      subtitle: `${v.item?.name ?? ""} — ${v.casterName ?? ""}`,
      tone: "pending",
      lines: [
        (v.kind === "damage")
          ? `The ${noun}s strike <strong>together</strong> — each target takes one combined roll.`
          : `Each ${noun} is its <strong>own attack</strong>, resolved in order.`,
        ...(v.distinct ? [`One ${noun} per target — this spell never doubles up.`] : []),
        `Closing fires the volley as aimed; the timer fires the even spread.`
      ]
    }) + `<div style="margin:0.35rem 0.25rem;">${rows}</div>` + bar,
    buttons: [{
      action: "fire", label: `Fire the ${noun}s`, icon: "fa-solid fa-meteor", default: true,
      callback: (_event, _button, d) => fireVolley(message, readAssignment(message, d.element ?? d))
    }],
    rejectClose: false
  });

  // The X is "get on with it", never a cancel: it fires with whatever the inputs hold.
  const close = dialog.close.bind(dialog);
  dialog.close = (...args) => {
    void fireVolley(message, readAssignment(message, dialog.element));
    return close(...args);
  };

  await openManagedPopup(key, message, dialog);
  // Render failed → no surface to press, and the native buttons are hidden: fire now.
  if ( livePopups.get(key) !== dialog ) return void fireVolley(message, null);
  // Bound after render (DialogV2 owns the DOM until now): each ray's icon tracks its select,
  // and any change re-judges every ray — a re-aim moves the spends with it.
  for ( const sel of dialog.element?.querySelectorAll?.("[data-bf-volley-ray]") ?? [] ) {
    sel.addEventListener("change", () => {
      const icon = dialog.element?.querySelector?.(`[data-bf-volley-icon="${sel.dataset.bfVolleyRay}"]`);
      const t = v.targets.find(x => x.uuid === sel.value);
      if ( icon ) {
        if ( t?.img ) {
          icon.src = t.img; icon.alt = t.name; icon.dataset.tooltip = t.name;
          icon.style.display = "";
        } else icon.style.display = "none";
      }
      try { drawRayJudgements(dialog.element, caster, activity); }
      catch(err) { console.error(`${TITLE} | Ray judgement failed to redraw.`, err); }
    });
  }
  if ( v.kind === "attack" ) {
    try { drawRayJudgements(dialog.element, caster, activity); }
    catch(err) { console.error(`${TITLE} | Ray judgement failed to draw.`, err); }
  }
}

/** Read the popup's inputs into an assignment; null/garbage falls back to the default. */
function readAssignment(message, element) {
  const v = message.getFlag(MODULE_ID, "volley");
  if ( !v || !(element instanceof HTMLElement) ) return null;
  if ( v.kind === "damage" ) {
    const rows = [];
    for ( const input of element.querySelectorAll("[data-bf-volley-uuid]") ) {
      const t = v.targets.find(x => x.uuid === input.dataset.bfVolleyUuid);
      if ( !t ) continue;
      rows.push({ uuid: t.uuid, name: t.name, count: Math.max(0, Math.floor(Number(input.value) || 0)) });
    }
    if ( !rows.length ) return null;
    // Normalize to exactly n (trim from the last rows, top up round-robin) — the popup must
    // never refuse to fire over arithmetic.
    let sum = rows.reduce((a, r) => a + r.count, 0);
    for ( let i = rows.length - 1; sum > v.n && i >= 0; i-- ) {
      const cut = Math.min(rows[i].count, sum - v.n);
      rows[i].count -= cut; sum -= cut;
    }
    for ( let i = 0; sum < v.n; i = (i + 1) % rows.length ) { rows[i].count++; sum++; }
    return rows;
  }
  const rays = [];
  for ( const sel of element.querySelectorAll("[data-bf-volley-ray]") ) {
    const t = v.targets.find(x => x.uuid === sel.value) ?? v.targets[0];
    if ( !t ) continue;
    const mode = element.querySelector(`[data-bf-volley-mode="${sel.dataset.bfVolleyRay}"]`)?.value;
    rays.push({ uuid: t.uuid, name: t.name,
      ...((mode === "advantage" || mode === "disadvantage") ? { mode } : {}) });
  }
  if ( rays.length !== v.n ) return null;
  // Distinct-targets: duplicate picks fall back to the one-each default — never refuse to fire.
  if ( v.distinct && (new Set(rays.map(r => r.uuid)).size !== rays.length) ) return null;
  return rays;
}

/* ---------------------------------------------------------------------------------------------
 * Firing — the drive, per kind
 * ------------------------------------------------------------------------------------------- */

async function fireVolley(message, assignment) {
  const before = message.getFlag(MODULE_ID, "volley");
  if ( before?.status !== "pending" ) return;
  const chosen = assignment ?? defaultAssignment(before);
  // The claim: button, X and buzzer all come through here, and only the first one drives.
  let claimed = false;
  await queueFlagWrite(message, "volley", v => {
    if ( v?.status !== "pending" ) return;
    v.status = "resolved";
    v.assignment = chosen;
    v.resolvedAt = Date.now();
    claimed = true;
  });
  if ( !claimed ) return;
  disarmDeadline(volleyTimers, message.id);
  livePopups.get(popupKey(message.id, "volley"))?.close?.({ force: true });

  try {
    const v = message.getFlag(MODULE_ID, "volley");
    // Through the CARD (lookup.js): a scroll's last spell is gone from the sheet by the time its
    // rays are driven; the card's snapshot still carries it.
    const activity = cardActivity(message, v.activityUuid);
    if ( !activity ) {
      console.warn(`${TITLE} | Volley activity ${v.activityUuid} no longer resolves — nothing driven.`);
      return;
    }
    if ( v.kind === "damage" ) await driveDarts(message, activity, v);
    else await driveRays(message, activity, v);
  } catch(err) {
    console.error(`${TITLE} | Volley drive failed.`, err);
  }
}

/** Aim the canvas at one actor uuid, run fn, restore the prior targets. */
async function aimed(uuid, fn) {
  const prior = [...game.user.targets].map(t => t.id);
  const token = canvas.tokens?.placeables?.find(t => t.actor?.uuid === uuid);
  try {
    game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: false }); });
    if ( token ) token.setTarget(true, { releaseOthers: true });
    await fn();
  } finally {
    game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: false }); });
    for ( const id of prior ) canvas.tokens?.get(id)?.setTarget(true, { releaseOthers: false });
  }
}

/**
 * DARTS: one aggregated damage roll per target that takes any. The roll's target snapshot (from
 * the canvas aim) is what the spell-damage claim and applier key on. `volleyDarts` feeds the
 * multiplier below; per-dart damage never scales with the slot — the count does.
 */
async function driveDarts(message, activity, v) {
  for ( const a of (v.assignment ?? []) ) {
    if ( !(a.count > 0) ) continue;
    await aimed(a.uuid, async () => {
      // ⚠ Nested, never dotted: a preRollDamageV2 stamp nests under the same flags and would
      // displace a dotted key.
      const rolls = await activity.rollDamage({}, { configure: false }, { data: {
        ...originData(message.id),
        flags: { [MODULE_ID]: { volleyFor: message.id, volleyTarget: a.uuid, volleyDarts: a.count } }
      } });
      // ⚠ A blocklisted spell's roll is born spellHoldPending; with NO hold on the usage card the
      // claim must be released here or the applier waits forever (hold/spell-hold.js's release
      // runs at use time, before these rolls exist). A stamped hold owns its own release.
      const rollMsg = rolls?.[0]?.parent;
      if ( (rollMsg instanceof ChatMessage)
        && !message.getFlag(MODULE_ID, "hold")
        && rollMsg.getFlag(MODULE_ID, "spellHoldPending") ) {
        await rollMsg.setFlag(MODULE_ID, "spellHoldPending", false);
      }
    });
  }
}

/**
 * RAYS: one real attack per ray, driven sequentially so the cards land in ray order — driving,
 * not resolution: a hold on ray 1 never makes ray 2 wait.
 */
async function driveRays(message, activity, v) {
  // The judge runs again as each ray fires, spends carried forward, and the record lands on the
  // ray's own attack message in the gate's shape, so the spend hook and the card read it.
  const caster = activity.item?.actor ?? null;
  const spent = new Set();
  for ( const [i, ray] of (v.assignment ?? []).entries() ) {
    let record = null;
    try {
      const token = tokenForUuid(ray.uuid);
      const j = (caster instanceof Actor)
        ? judgeRoll(caster, { activity, targets: token ? [token] : [], spent }) : null;
      for ( const id of (j?.spends ?? []) ) spent.add(id);
      if ( j?.sources?.length ) {
        record = { ...reminderRecord({ sources: j.sources, net: j.net, mode: ray.mode ?? "normal", answeredAt: Date.now() }),
          ...statContext(caster.uuid) };
      }
    } catch(err) {
      console.error(`${TITLE} | Ray ${i + 1} judgement failed — rolling without a record.`, err);
    }
    // The mode rides the roll's advantage/disadvantage booleans: applyKeybindings recomputes
    // advantageMode from this pair and an explicit boolean out-votes the data-driven one.
    const cfg = (ray.mode === "advantage")
      ? { rolls: [{ options: { advantage: true, disadvantage: false } }] }
      : (ray.mode === "disadvantage")
        ? { rolls: [{ options: { advantage: false, disadvantage: true } }] }
        : {};
    await aimed(ray.uuid, () => activity.rollAttack(cfg, { configure: false }, { data: {
      ...originData(message.id),
      flags: { [MODULE_ID]: { volleyFor: message.id, volleyRay: i + 1, ...(record ? { [REMINDER_FLAG]: record } : {}) } }
    } }));
  }
}

/**
 * The dart multiplier: k darts = k copies of the base damage entry in ONE roll (a formula rewrite
 * would share dice). Armed by the pending message's own flag, so nothing leaks across rolls.
 */
Hooks.on("dnd5e.preRollDamageV2", (config, _dialog, message) => {
  const k = Number(foundry.utils.getProperty(message?.data ?? {}, `flags.${MODULE_ID}.volleyDarts`)) || 0;
  if ( k < 2 ) return;
  const base = config.rolls?.[0];
  if ( !base ) return;
  for ( let i = 1; i < k; i++ ) {
    config.rolls.push({
      data: base.data,
      parts: [...(base.parts ?? [])],
      options: foundry.utils.deepClone(base.options ?? {})
    });
  }
});

/* ---------------------------------------------------------------------------------------------
 * The table's view + the author's resume
 * ------------------------------------------------------------------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const v = message.getFlag(MODULE_ID, "volley");
  if ( !v ) return void renderVolleyAim(message, html);
  renderVolleyRow(message, v, html);
  // Author-side resume after a reload: re-arm the buzzer and re-raise the popup; an overdue
  // deadline fires the default spread now.
  // ⚠ This path fires DIRECTLY, not through `armDeadline`, so it checks the deadline ceiling
  // itself (core.js `deadlineIsLive`): past it, a months-old pending volley raises the popup
  // for a human instead of rolling on open.
  if ( (v.status === "pending") && message.isAuthor ) {
    const stale = v.deadline && !deadlineIsLive(v.deadline);
    if ( !stale && v.deadline && (Date.now() >= v.deadline) ) void fireVolley(message, null);
    else {
      if ( v.deadline && !stale ) {
        armDeadline(volleyTimers, message.id, v.deadline, () => fireVolley(message, null));
      }
      void openVolleyPopup(message);
    }
  }
});

// The delete sweep: ui.js's shared sweep closes the popup but disarms only the hold's clock —
// each machine disarms its own, or a deleted pending volley's buzzer fires on nothing.
Hooks.on("deleteChatMessage", message => {
  disarmDeadline(volleyTimers, message.id);
});

function renderVolleyRow(_message, v, html) {
  const content = html.querySelector?.(SURFACES.messageContent) ?? html;
  if ( !content || content.querySelector(".bf-volley-row") ) {
    // Re-render with a resolved flag: replace the pending row so the bar never lingers.
    const row = content?.querySelector?.(".bf-volley-row");
    if ( row && (row.dataset.bfStatus !== v.status) ) row.remove();
    else return;
  }
  const noun = unitNoun(v);
  const div = document.createElement("div");
  div.className = "bf-volley-row";
  div.dataset.bfStatus = v.status;
  div.style.cssText = "margin:0.3rem 0;padding:0.3rem 0.4rem;border:1px solid var(--color-border-light-2,#999);border-radius:4px;font-size:var(--font-size-12,12px);";
  if ( v.status === "pending" ) {
    const bar = (v.deadline && v.window) ? momentBarHTML({ deadline: v.deadline, window: v.window }, "to aim") : "";
    div.innerHTML = `<i class="fa-solid fa-meteor" data-tooltip="Volley"></i>
      <strong>Volley</strong> — ${v.n} ${esc(noun)}s, ${esc(v.casterName ?? "the caster")} is aiming${bar}`;
  } else {
    const summary = (v.kind === "damage")
      ? (v.assignment ?? []).filter(a => a.count > 0).map(a => `${esc(a.name)} ×${a.count}`).join(", ")
      : (v.assignment ?? []).map((a, i) => `${i + 1}→${esc(a.name)}${a.mode === "advantage" ? " (adv)" : a.mode === "disadvantage" ? " (dis)" : ""}`).join(", ");
    div.innerHTML = `<i class="fa-solid fa-meteor" data-tooltip="Volley"></i>
      <strong>Volley</strong> — ${v.n} ${esc(noun)}s: ${summary || "unaimed"}`;
  }
  content.appendChild(div);
}

/**
 * Every driven volley roll names its target on the card, read off the roll's own target snapshot
 * (pure, no lookups). A ray's damage chains off its attack card, which names the target above it.
 */
function renderVolleyAim(message, html) {
  if ( !message.getFlag(MODULE_ID, "volleyFor") ) return;
  const target = targetsOf(message)[0];
  if ( !target?.name ) return;
  const content = html.querySelector?.(SURFACES.messageContent) ?? html;
  if ( !content || content.querySelector(".bf-volley-aim") ) return;
  const ray = Number(message.getFlag(MODULE_ID, "volleyRay")) || 0;
  const div = document.createElement("div");
  div.className = "bf-volley-aim";
  div.style.cssText = "display:flex;align-items:center;gap:0.4rem;margin:0.2rem 0;font-size:var(--font-size-12,12px);";
  div.innerHTML = `${target.img ? `<img src="${esc(target.img)}" alt="${esc(target.name)}"
      data-tooltip="${esc(target.name)}"
      style="width:22px;height:22px;border:none;border-radius:4px;object-fit:cover;">` : ""}
    <span>${ray ? `Ray ${ray} → ` : "→ "}<strong>${esc(target.name)}</strong></span>`;
  content.prepend(div);
}
