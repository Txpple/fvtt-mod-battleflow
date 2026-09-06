/**
 * Battle Flow — the volley folds (Phase 1.7, FLOW item 6 / Pass C).
 *
 * A volley is a spell that throws N projectiles in one action — Magic Missile's darts,
 * Scorching Ray's rays. The system rolls exactly ONE subsequent action per use
 * (AttackActivity fires one attack, DamageActivity one damage roll), so the table's natural
 * play collapsed every time: session 4 re-cast Scorching Ray three times for one volley and
 * hand-lumped Magic Missile's dice. The fold suppresses that single native follow-up and
 * gives the CASTER one popup to aim the whole volley instead.
 *
 * The two kinds genuinely differ, and the difference is RAW (FLOW item 6, pinned):
 *   - DAMAGE kind (Magic Missile): darts strike SIMULTANEOUSLY — each target gets ONE
 *     aggregated damage roll (k darts = k dice groups in one roll message), so one
 *     application and ONE concentration check per target. The roll is aimed by setting the
 *     canvas target around `rollDamage` (the maneuvers drive idiom), so the roll message's
 *     own snapshot names exactly that target — and polish.js's existing `spellDamage` birth
 *     stamp + hold/spell-damage.js's applier do the application, the hold blocklist (Magic Missile:Shield)
 *     defers it, and concentration rides the application. Nothing downstream is new.
 *   - ATTACK kind (Scorching Ray): each ray is its OWN attack, resolved independently — the
 *     fold drives one real `rollAttack` per ray at that ray's chosen target through the
 *     ordinary pipeline. Auto-damage (or the player's own damage offer), reaction holds and
 *     hit riders all fire PER RAY, which is the recorded per-roll ruling (ARCHITECTURE.md
 *     1.6: "N driven rolls are N independent rider folds"). A hold on ray 2 pauses ray 2's
 *     damage and nothing else.
 *
 * DETECTION IS THE REGISTRY (finding (ff), 2026-08-21 — volley-registry.js carries the
 * user directive verbatim and the census that grounds it): a spell volleys iff its name is
 * listed, with the listed per-spell handling (kind, count formula, distinct-targets), and
 * an unlisted spell never volleys no matter what its copy's data says. The census measured
 * content data wrong in BOTH directions — the 2024 pack ships Scorching Ray bare and
 * Dimension Door count-2-with-a-damage-activity — so content counts decide nothing here.
 * A registered name still volleys only when the USED activity matches the entry's kind and
 * the count evaluates 2+ at this cast; everything else stays fully native.
 *
 * THE CLAIM SHAPE (the Pass C unblock recorded in ARCHITECTURE.md §6): the volley's claim
 * is `usageConfig.subsequentActions = false`, set in dnd5e.preUseActivity on the casting
 * client — the same flag walk-4 (v) passes on every module-driven `use`, arriving through
 * the hook's mutable config instead (the potion-aim seam). Suppressing it also skips the
 * system's own `flags.dnd5e.consumed` write (the Refund Resource dependency), so the stamp
 * replicates that one line verbatim.
 *
 * LOCALITY: everything here runs on the CASTING client — preUse/postUse fire where `use()`
 * ran, the popup is the caster's own decision, and the driven rolls are their dice (the
 * damage-offer family's locality; no elect, no relay). The card runs the PUBLIC bar (the
 * pairing rule) on every client. ⚠ Accepted family limit, recorded: the buzzer lives on the
 * casting client, so a caster who F5s mid-window and never returns leaves the volley
 * unfired — the card shows the drained bar, and the GM's fallback is the sheet, exactly as
 * for the damage offers. Render-resume re-pops and re-arms on the author's return.
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

const volleyTimers = new Map();

/* ---------------------------------------------------------------------------------------------
 * Detection
 * ------------------------------------------------------------------------------------------- */

/**
 * Is this use a volley? Null when it is not — and every `null` here means the fully native
 * path, untouched. Membership is the registry's (volley-registry.js), and the entry's kind
 * must match the used activity so a listed spell's other activities stay native. Targetless
 * casts stay native on purpose: a volley with nothing to aim at is just a damage roll, and
 * the existing machinery already owns that case. A distinct-targets entry (Steel Wind
 * Strike) throws at most one projectile per creature, so its n clamps to the target count.
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

Hooks.on("dnd5e.preUseActivity", (activity, usageConfig, dialogConfig, messageConfig) => {
  const snapshot = foundry.utils.getProperty(messageConfig ?? {}, "data.flags.dnd5e.targets");
  const spec = volleySpec(activity, usageConfig, Array.isArray(snapshot) ? snapshot.length : 0);
  if ( !spec ) return;
  // The claim: no native single follow-up roll — the volley drives every projectile itself.
  usageConfig.subsequentActions = false;
});

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  const message = (results?.message instanceof ChatMessage) ? results.message : null;
  if ( !message ) return;
  const targets = (message.getFlag("dnd5e", "targets") ?? [])
    .map(t => ({ uuid: t.uuid, name: t.name, img: t.img ?? null }));
  // The message's own spellLevel is the cast level the system stands behind (see
  // castLevelOf's warning) — the config is only the fallback for content that never
  // stamps one.
  const spellLevel = Number(message.system?.spellLevel) || 0;
  const spec = volleySpec(activity, usageConfig, targets.length,
    spellLevel ? { castLevel: spellLevel } : {});
  if ( !spec ) return;
  void stampVolley(activity, message, targets, spec);
});

async function stampVolley(activity, message, targets, spec) {
  try {
    if ( message.getFlag(MODULE_ID, "volley") ) return; // never re-stamp
    // Replicate the consumed-flag write the suppressed subsequentActions block skips —
    // verbatim the system's own two lines (Activity#use, 5.3.3). ⚠ Measured: that helper
    // records HIT DICE spends only (`system.hd.spent`) and returns void for everything
    // else; Refund Resource's real channel is the usage message's own `system.deltas`,
    // which consumption already stamped untouched. This call exists so even the hd edge
    // behaves natively.
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
    // Locality: this hook already runs on the casting client — the popup is theirs.
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
 * THE GATE MEETS THE RAYS AT THE AIM (user, 2026-09-02 — BACKLOG "Volley spells and the gate").
 * The rays roll with the dialog suppressed, so the reminder gate (reminders.js) never sees
 * them — and the aim popup already holds every fact the gate needs: the caster, one target per
 * ray, one mode per ray, and the order the rays fire in. So the gate's own judge runs here,
 * once per ray, in ray order: each ray row carries the section folded to its header line
 * ("2 Modifiers — Net [tag]"; open it for the boxes), the ray's mode select DEFAULTS to its net
 * (the dialog's highlighted-button rule, the same ruling), and re-aiming a ray re-judges every
 * ray after it. Spends are carried forward in ray order — the rules spend Sap on "its next
 * attack roll" and Vex on "your next attack roll against that creature", which is ONE ray each
 * (canon, N1) — so the chip shows on the first ray that uses it and on none after. The drive
 * runs the same judge again per ray as it fires and stamps the record on the ray's own attack
 * message, so the card line and the stats plane read a ray exactly as they read a sword.
 * Darts are damage, not attack rolls: nothing to judge, nothing drawn.
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
  // The rays' judge needs the caster and the activity (the range kind reads the spell's own
  // range); a volley whose activity no longer resolves aims without a judgement.
  const activity = (v.kind === "attack") ? await fromUuid(v.activityUuid).catch(() => null) : null;
  const caster = activity?.item?.actor ?? null;

  const noun = unitNoun(v);
  // (hh): every popup row shows WHO — the target's token icon beside its name (law 8
  // tooltip), read off the stamped snapshot. A target without an image degrades to its name.
  const iconHTML = t => t?.img
    ? `<img src="${esc(t.img)}" alt="${esc(t.name)}" data-tooltip="${esc(t.name)}"
        style="width:22px;height:22px;border:none;border-radius:4px;object-fit:cover;flex:0 0 auto;">`
    : "";
  // The ray variant always renders the element (hidden when imageless) so the change
  // listener below has something to reveal when the pick moves to a target WITH an image.
  const rayIconHTML = (i, t) => `<img data-bf-volley-icon="${i}" src="${esc(t?.img ?? "")}"
      alt="${esc(t?.name ?? "")}" ${t?.img ? `data-tooltip="${esc(t.name)}"` : ""}
      style="width:22px;height:22px;border:none;border-radius:4px;object-fit:cover;flex:0 0 auto;${t?.img ? "" : "display:none;"}">`;
  const rows = (v.kind === "damage")
    // One stepper per target: how many darts land there.
    ? v.targets.map((t, i) => {
      const def = defaultAssignment(v).find(a => a.uuid === t.uuid)?.count ?? 0;
      // One row, the card grammar (user tweak 2026-08-21): [icon] **Name** is targeted [n]
      return `<div style="display:flex;align-items:center;gap:0.5rem;margin:0.15rem 0;">
        ${iconHTML(t)}
        <label style="flex:1;"><strong>${esc(t.name)}</strong> <span style="opacity:0.8;">is targeted</span></label>
        <input type="number" data-bf-volley-uuid="${esc(t.uuid)}" value="${def}"
          min="0" max="${v.n}" step="1" style="width:4rem;text-align:center;">
      </div>`;
    }).join("")
    // One target pick per ray — and the ray's mode ((dd), RAW; the concentration popup's
    // Adv/Normal/Dis is the in-house precedent). "Normal" passes NO override so sheet-borne
    // modifiers keep applying themselves; only an explicit pick forces the booleans.
    // The row's icon is the SELECTED target's (the dart-row pattern, user ask (hh)) — a
    // change listener bound after render keeps it tracking the pick.
    : Array.from({ length: v.n }, (_, i) => {
      const def = defaultAssignment(v)[i]?.uuid;
      const defTarget = v.targets.find(t => t.uuid === def);
      const options = v.targets.map(t =>
        `<option value="${esc(t.uuid)}" ${t.uuid === def ? "selected" : ""}>${esc(t.name)}</option>`).join("");
      // The icon LEADS the row (the dart rows' and the cards' grammar — user tweak
      // 2026-08-21); it still tracks the select via the listener below.
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
      callback: (event, button, d) => fireVolley(message, readAssignment(message, d.element ?? d))
    }],
    rejectClose: false
  });

  // The X is "get on with it", never a cancel — the family rule. It fires with whatever the
  // inputs hold at that moment (they start at the default spread).
  const close = dialog.close.bind(dialog);
  dialog.close = (...args) => {
    void fireVolley(message, readAssignment(message, dialog.element));
    return close(...args);
  };

  await openManagedPopup(key, message, dialog);
  // Render failed → no surface to press, and the native buttons are hidden: fire now.
  if ( livePopups.get(key) !== dialog ) return void fireVolley(message, null);
  // (hh): each ray row's icon tracks its own select, so the row always shows WHO the ray
  // is on. Bound after render because DialogV2 owns the DOM until now. The same change
  // re-judges every ray — a re-aim moves the spends with it.
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
    // Normalize to exactly n: trim overflow from the last rows up, top up round-robin — the
    // popup must never refuse to fire over arithmetic (expiry-class safety).
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
    const activity = await fromUuid(v.activityUuid);
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

/** Aim the canvas at one actor uuid, run fn, restore — the maneuvers drive idiom. */
async function aimed(uuid, fn) {
  const prior = [...game.user.targets].map(t => t.id);
  const token = canvas.tokens?.placeables?.find(t => t.actor?.uuid === uuid);
  try {
    game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
    if ( token ) token.setTarget(true, { releaseOthers: true });
    await fn();
  } finally {
    game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
    for ( const id of prior ) canvas.tokens?.get(id)?.setTarget(true, { releaseOthers: false });
  }
}

/**
 * DARTS: one aggregated damage roll per target that takes any. The roll message's own
 * target snapshot (stamped from the canvas aim) is what polish.js's spellDamage claim and
 * hold/spell-damage.js's applier key on — per-target application, hold deferral and the per-target
 * concentration check are all the EXISTING machinery. `volleyDarts` is read by the
 * preRollDamageV2 multiplier below; per-dart damage never scales with the slot (the count
 * does — measured: MM's part carries no scaling mode).
 */
async function driveDarts(message, activity, v) {
  for ( const a of (v.assignment ?? []) ) {
    if ( !(a.count > 0) ) continue;
    await aimed(a.uuid, async () => {
      const rolls = await activity.rollDamage({}, { configure: false }, { data: {
        "flags.dnd5e.originatingMessage": message.id,
        [`flags.${MODULE_ID}.volleyFor`]: message.id,
        [`flags.${MODULE_ID}.volleyTarget`]: a.uuid,
        [`flags.${MODULE_ID}.volleyDarts`]: a.count
      } });
      // The caster's own claim release (hold/spell-hold.js's releaseUnheldSpellDamage cannot see these
      // rolls — it polls at USE time and the volley rolls arrive a popup later): a
      // blocklisted spell's roll is born spellHoldPending, and when the usage card carries
      // NO hold — nobody eligible, everyone spent — the claim must fold or the applier
      // waits forever. A stamped hold needs nothing here: its resolution owns the release.
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
 * RAYS: one REAL attack per ray at its chosen target, sequentially so the cards land in
 * ray order. Each drive is the ordinary pipeline from rollAttackV2 on: auto-damage or the
 * player's own offer, a hold pausing that ray's damage, riders folding per ray. Sequential
 * DRIVING, not sequential resolution — a hold on ray 1 never makes ray 2 wait.
 */
async function driveRays(message, activity, v) {
  // The judge runs again as each ray fires — the same computation the popup showed, the spends
  // carried forward — and the record lands on the ray's own attack message (the gate's flag,
  // the gate's shape), so the spend hook honours against the net it showed and the card says
  // what was on the table. `mode` is the ray's pick; no pick is a normal roll.
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
    // The ray's mode rides the roll's own advantage/disadvantage booleans — the
    // concentration answer's channel (applyKeybindings recomputes advantageMode from
    // exactly this pair, and mergeConfigs lets the explicit boolean out-vote the
    // data-driven one). No mode passes nothing, so sheet-borne modifiers keep applying
    // themselves.
    const cfg = (ray.mode === "advantage")
      ? { rolls: [{ options: { advantage: true, disadvantage: false } }] }
      : (ray.mode === "disadvantage")
        ? { rolls: [{ options: { advantage: false, disadvantage: true } }] }
        : {};
    await aimed(ray.uuid, () => activity.rollAttack(cfg, { configure: false }, { data: {
      "flags.dnd5e.originatingMessage": message.id,
      [`flags.${MODULE_ID}.volleyFor`]: message.id,
      [`flags.${MODULE_ID}.volleyRay`]: i + 1,
      ...(record ? { [`flags.${MODULE_ID}.${REMINDER_FLAG}`]: record } : {})
    } }));
  }
}

/**
 * The dart multiplier: k darts at one target = k copies of the base damage entry in ONE
 * roll message — dice-correct for any content (a formula rewrite would re-roll shared dice),
 * one aggregate application, and the card reads as k visible dart groups. The armed state
 * IS the pending message's own flag, so nothing here can leak across rolls.
 */
Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
  const k = Number(message?.data?.[`flags.${MODULE_ID}.volleyDarts`]) || 0;
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
 * The table's view + the author's resume (render is the convergence floor, as everywhere)
 * ------------------------------------------------------------------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const v = message.getFlag(MODULE_ID, "volley");
  if ( !v ) return void renderVolleyAim(message, html);
  renderVolleyRow(message, v, html);
  // Author-side resume: re-arm the buzzer and re-raise the popup after an F5. An already-
  // overdue deadline fires the default spread now — the volley never strands on a reload.
  //
  // ⚠ THE CEILING REACHES HERE TOO (core.js), and this path needs it stated separately
  // because it fires the spread DIRECTLY rather than through `armDeadline` — the guard in
  // the primitive cannot see it. Without this, a volley left pending in the world rolls its
  // darts the instant the author next opens it, however many months later. Past the ceiling
  // the clock is history: raise the popup and let a human aim it, the same answer the
  // caster-who-never-came-back already gets.
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

// The delete sweep. Every other timer-owning machine registers one (concentration, maneuvers,
// mastery, saves) and this file was the exception: `volleyTimers` was disarmed only when a
// volley FIRED, so deleting a pending volley card left its buzzer armed to call `fireVolley`
// on a message that no longer exists. The shared sweep in ui.js closes the popup and clears
// the latch, but it disarms the hold's clock only — each machine still owns its own.
Hooks.on("deleteChatMessage", message => {
  disarmDeadline(volleyTimers, message.id);
});

function renderVolleyRow(message, v, html) {
  const content = html.querySelector?.(".message-content") ?? html;
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
 * (ee): every driven volley roll names its target on the card — token icon (tooltip, law 8)
 * + name, read off the roll's own dnd5e target snapshot (the aimed() canvas target at drive
 * time), so the render is pure and needs no lookups. Dart damage rolls carry volleyTarget,
 * ray attacks volleyRay; a ray's follow-up damage chains off its attack card, which names
 * the target right above it.
 */
function renderVolleyAim(message, html) {
  if ( !message.getFlag(MODULE_ID, "volleyFor") ) return;
  const target = (message.getFlag("dnd5e", "targets") ?? [])[0];
  if ( !target?.name ) return;
  const content = html.querySelector?.(".message-content") ?? html;
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
