/**
 * Battle Flow — the volley folds: a spell throwing N projectiles gets ONE caster popup to aim them
 * all (the system rolls one follow-up). DARTS: one aggregated damage roll per target (one
 * application, one concentration check). RAYS: a real `rollAttack` each. Membership is
 * volley-registry.js alone. Everything runs on the CASTING client.
 */
import { MODULE_ID, TITLE, queueFlagWrite, deadlineIsLive, statContext, decisionWindow } from "./core.js";
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
import { listen } from "./dispatch.js";

const volleyTimers = new Map();

/** Is this use a volley (null = native)? A distinct-targets entry clamps n to the target count. */
function volleySpec(activity, usageConfig, targetCount, { castLevel } = {}) {
  const entry = volleyEntryFor(activity?.item);
  if ( !entry ) return null;
  if ( activity.type !== entry.kind ) return null;
  if ( !activity.damage?.parts?.length ) return null;
  if ( !(targetCount > 0) ) return null;
  const level = castLevel ?? castLevelOf(activity, usageConfig);
  const n = clampVolleyCount(resolveVolleyCount(entry, activity, level), targetCount,
    entry.distinctTargets);
  if ( n === null ) return null;
  return { n, castLevel: level, distinct: !!entry.distinctTargets };
}

listen("dnd5e.preUseActivity", "volleys", (activity, usageConfig, _dialogConfig, messageConfig) => {
  const snapshot = targetsInData(messageConfig?.data);
  const spec = volleySpec(activity, usageConfig, snapshot ? snapshot.length : 0);
  if ( !spec ) return;
  // The claim: the volley drives every projectile itself.
  usageConfig.subsequentActions = false;
});

listen("dnd5e.postUseActivity", "volleys", (activity, usageConfig, results) => {
  const message = (results?.message instanceof ChatMessage) ? results.message : null;
  if ( !message ) return;
  const targets = targetsOf(message)
    .map(t => ({ uuid: t.uuid, name: t.name, img: t.img ?? null }));
  // The message's own cast level stands; the config is only the fallback.
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
    try {
      const consumed = activity.createConsumedFlag?.(activity.actor, message.system?.deltas);
      if ( consumed ) activity.item.updateSource({ "flags.dnd5e.consumed": consumed });
    } catch { /* refund keeps working through the deltas either way */ }

    const window = decisionWindow();
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
    void openVolleyPopup(message);
  } catch(err) {
    console.error(`${TITLE} | Could not stamp the volley.`, err);
  }
}

/** Even spread, first targets first — what the buzzer fires and the popup pre-fills. */
function defaultAssignment(v) {
  if ( v.kind === "damage" ) {
    const rows = v.targets.map(t => ({ uuid: t.uuid, name: t.name, count: 0 }));
    for ( let i = 0; i < v.n; i++ ) rows[i % rows.length].count++;
    return rows;
  }
  return Array.from({ length: v.n }, (_, i) => {
    const t = v.distinct ? v.targets[i] : v.targets[i % v.targets.length];
    return { uuid: t.uuid, name: t.name };
  });
}

const unitNoun = v => (v.kind === "damage") ? "dart" : "ray";

/** The gate at the aim (RULINGS *A volley meets the gate at its aim*): one judgement per ray, in
 * order, spends carried forward; `picks` are the aimed uuids. Null where there is no caster. */
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
  // An activity that no longer resolves aims without a judgement.
  const activity = (v.kind === "attack") ? cardActivity(message, v.activityUuid) : null;
  const caster = activity?.item?.actor ?? null;

  const noun = unitNoun(v);
  const iconHTML = t => t?.img
    ? `<img src="${esc(t.img)}" alt="${esc(t.name)}" data-tooltip="${esc(t.name)}"
        style="width:22px;height:22px;border:none;border-radius:4px;object-fit:cover;flex:0 0 auto;">`
    : "";
  // Always rendered (hidden when imageless) so a re-pick has an element to reveal.
  const rayIconHTML = (i, t) => `<img data-bf-volley-icon="${i}" src="${esc(t?.img ?? "")}"
      alt="${esc(t?.name ?? "")}" ${t?.img ? `data-tooltip="${esc(t.name)}"` : ""}
      style="width:22px;height:22px;border:none;border-radius:4px;object-fit:cover;flex:0 0 auto;${t?.img ? "" : "display:none;"}">`;
  const rows = (v.kind === "damage")
    ? v.targets.map((t, _i) => {
      const def = defaultAssignment(v).find(a => a.uuid === t.uuid)?.count ?? 0;
      return `<div style="display:flex;align-items:center;gap:0.5rem;margin:0.15rem 0;">
        ${iconHTML(t)}
        <label style="flex:1;"><strong>${esc(t.name)}</strong> <span style="opacity:0.8;">is targeted</span></label>
        <input type="number" data-bf-volley-uuid="${esc(t.uuid)}" value="${def}"
          min="0" max="${v.n}" step="1" style="width:4rem;text-align:center;">
      </div>`;
    }).join("")
    // "Normal" passes NO override, so sheet-borne modifiers keep applying themselves.
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
  // Render failed → no surface to press: fire now.
  if ( livePopups.get(key) !== dialog ) return void fireVolley(message, null);
  // Bound after render; any change re-judges every ray — a re-aim moves the spends with it.
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
    // Normalize to exactly n — the popup never refuses to fire over arithmetic.
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
    // Through the CARD: a scroll's last spell is gone from the sheet by now.
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

/** DARTS: one aggregated damage roll per target; the canvas aim sets the snapshot the spell-damage
 * applier keys on. `volleyDarts` feeds the multiplier below. */
async function driveDarts(message, activity, v) {
  for ( const a of (v.assignment ?? []) ) {
    if ( !(a.count > 0) ) continue;
    await aimed(a.uuid, async () => {
      // ⚠ Nested, never dotted: a preRollDamage stamp nests under the same flags.
      const rolls = await activity.rollDamage({}, { configure: false }, { data: {
        ...originData(message.id),
        flags: { [MODULE_ID]: { volleyFor: message.id, volleyTarget: a.uuid, volleyDarts: a.count } }
      } });
      // ⚠ A blocklisted spell's roll is born spellHoldPending; with NO hold on the card, release it
      // here or the applier waits forever (spell-hold.js releases at use time, before these rolls).
      const rollMsg = rolls?.[0]?.parent;
      if ( (rollMsg instanceof ChatMessage)
        && !message.getFlag(MODULE_ID, "hold")
        && rollMsg.getFlag(MODULE_ID, "spellHoldPending") ) {
        await rollMsg.setFlag(MODULE_ID, "spellHoldPending", false);
      }
    });
  }
}

/** RAYS: one real attack each, in order; a hold on ray 1 never makes ray 2 wait. */
async function driveRays(message, activity, v) {
  // Re-judged as each ray fires; the record lands on the ray's message in the gate's shape.
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
    // The booleans, not advantageMode: applyKeybindings recomputes it from this pair.
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

// The dart multiplier: k darts = k copies of the base entry in ONE roll (a formula rewrite would
// share dice), armed by the pending message's own flag.
listen("dnd5e.preRollDamage", "volleys", (config, _dialog, message) => {
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

listen("dnd5e.renderChatMessage", "volleys", (message, html) => {
  const v = message.getFlag(MODULE_ID, "volley");
  if ( !v ) return void renderVolleyAim(message, html);
  renderVolleyRow(message, v, html);
  // Author-side resume: re-arm and re-raise; overdue fires now. ⚠ This path fires DIRECTLY, so it
  // checks `deadlineIsLive` itself — a months-old volley raises the popup instead of rolling.
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

// ui.js's sweep disarms only the hold's clock; each machine disarms its own.
listen("deleteChatMessage", "volleys", message => {
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

/** Every driven volley roll names its target on the card, off the roll's own snapshot. */
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
